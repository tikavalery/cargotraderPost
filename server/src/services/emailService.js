import crypto from 'crypto';

/** SHA-256 hash for invitation token lookup (token itself never stored). */
export function hashInviteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return hashInviteToken(token);
}

const PLACEHOLDER_SMTP_HOSTS = new Set([
  'smtp.example.com',
  'example.com',
  'mail.example.com',
  'localhost',
  '127.0.0.1'
]);

/** True only when SMTP is configured with a real host and credentials. */
export function isSmtpConfigured() {
  const host = (process.env.SMTP_HOST || '').trim().toLowerCase();
  const user = (process.env.SMTP_USER || '').trim();
  if (!host || PLACEHOLDER_SMTP_HOSTS.has(host)) return false;
  if (!user) return false;
  return true;
}

async function createSmtpTransporter() {
  const nodemailer = await import('nodemailer');
  const tlsFlag = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').trim().toLowerCase();
  const relaxTls =
    tlsFlag === 'false' ||
    (tlsFlag !== 'true' && process.env.NODE_ENV !== 'production');

  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    ...(relaxTls ? { tls: { rejectUnauthorized: false } } : {})
  });
}

async function sendSmtpMail({ to, subject, text, html }) {
  const transporter = await createSmtpTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'CargoTrader <noreply@cargotrader.local>',
    to,
    subject,
    text,
    html
  });
}

function buildInviteEmail({ businessName, role, inviterName, inviteUrl }) {
  const subject = `Join ${businessName} on CargoTrader`;
  const text = [
    'Hello,',
    '',
    `${inviterName} invited you to join ${businessName} as ${role}.`,
    '',
    'Complete your registration and set your password:',
    inviteUrl,
    '',
    'This link expires in 7 days.',
    '',
    '— CargoTrader'
  ].join('\n');

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1A2332">
      <h2 style="color:#1A3C5E">You're invited to CargoTrader</h2>
      <p><strong>${inviterName}</strong> invited you to join <strong>${businessName}</strong> as <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Complete registration</a></p>
      <p style="font-size:13px;color:#8A97A8">Or copy this link: ${inviteUrl}</p>
      <p style="font-size:12px;color:#8A97A8">This invitation expires in 7 days.</p>
    </div>`;

  return { subject, text, html };
}

function logInviteLink({ to, subject, inviteUrl, reason }) {
  console.log(`\n[email] Staff invite — ${reason}:`);
  if (to) console.log(`  To: ${to}`);
  if (subject) console.log(`  Subject: ${subject}`);
  console.log(`  Link: ${inviteUrl}\n`);
}

/**
 * Send staff invitation email. Uses SMTP when properly configured; otherwise logs link.
 * Never throws — invitation creation should succeed even if email fails.
 * @returns {{ sent: boolean, preview?: string, reason?: string }}
 */
export async function sendStaffInviteEmail({ to, inviteUrl, businessName, role, inviterName }) {
  const { subject, text, html } = buildInviteEmail({ businessName, role, inviterName, inviteUrl });

  if (!isSmtpConfigured()) {
    logInviteLink({
      to,
      subject,
      inviteUrl,
      reason: 'SMTP not configured (set SMTP_HOST to a real server, e.g. smtp.gmail.com)'
    });
    return { sent: false, preview: inviteUrl, reason: 'smtp_not_configured' };
  }

  try {
    await sendSmtpMail({ to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send staff invite:', err.message);
    logInviteLink({ to, inviteUrl, reason: 'email send failed — share link manually' });
    return { sent: false, preview: inviteUrl, reason: 'send_failed', error: err.message };
  }
}

function buildPasswordResetEmail({ name, resetUrl }) {
  const subject = 'Reset your CargoTrader password';
  const text = [
    `Hello${name ? ` ${name}` : ''},`,
    '',
    'We received a request to reset your password.',
    '',
    'Reset your password:',
    resetUrl,
    '',
    'This link expires in 1 hour. If you did not request this, you can ignore this email.',
    '',
    '— CargoTrader'
  ].join('\n');

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1A2332">
      <h2 style="color:#1A3C5E">Reset your password</h2>
      <p>Hello${name ? ` <strong>${name}</strong>` : ''},</p>
      <p>We received a request to reset your CargoTrader password.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#E85D26;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p>
      <p style="font-size:13px;color:#8A97A8">Or copy this link: ${resetUrl}</p>
      <p style="font-size:12px;color:#8A97A8">This link expires in 1 hour. If you did not request this, ignore this email.</p>
    </div>`;

  return { subject, text, html };
}

function logResetLink({ to, resetUrl, reason }) {
  console.log(`\n[email] Password reset — ${reason}:`);
  if (to) console.log(`  To: ${to}`);
  console.log(`  Link: ${resetUrl}\n`);
}

/**
 * Send password reset email. Uses SMTP when configured; otherwise logs link to console.
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const { subject, text, html } = buildPasswordResetEmail({ name, resetUrl });

  if (!isSmtpConfigured()) {
    logResetLink({ to, resetUrl, reason: 'SMTP not configured' });
    return { sent: false, preview: resetUrl, reason: 'smtp_not_configured' };
  }

  try {
    await sendSmtpMail({ to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send password reset:', err.message);
    logResetLink({ to, resetUrl, reason: 'email send failed' });
    return { sent: false, preview: resetUrl, reason: 'send_failed', error: err.message };
  }
}

/**
 * Generic billing / subscription email (payment failed, receipt, downgrade).
 * Never throws — billing flows must continue if SMTP is down.
 */
export async function sendBillingEmail({ to, subject, text, html, previewLog }) {
  if (!to) return { sent: false, reason: 'no_recipient' };

  if (!isSmtpConfigured()) {
    console.log(`\n[email] Billing — SMTP not configured:`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    if (previewLog) console.log(`  Context: ${previewLog}`);
    console.log('');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    await sendSmtpMail({ to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[email] Failed to send billing email:', err.message);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}
