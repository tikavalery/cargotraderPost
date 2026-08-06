import LegalPageLayout from './LegalPageLayout';

const SUPPORT_EMAIL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.VITE_SUPPORT_EMAIL)) ||
  'support@cargotrader.app';

export default function ContactSupportPage() {
  const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CargoTrader support')}`;

  return (
    <LegalPageLayout title="Contact Support">
      <p>
        Need help with your account, billing, or a product issue? Reach the CargoTrader
        team using the options below. We typically respond within one business day.
      </p>

      <h2>Email</h2>
      <p>
        <a className="legal-mail" href={mailHref}>
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="legal-muted">
        Include your business name, the email on your account, and a short description of the
        issue. For billing disputes, also include the approximate charge date and plan.
      </p>

      <h2>Billing &amp; subscriptions</h2>
      <p>
        Paid plans are billed in <strong>USD</strong> through Stripe. Business owners can open{' '}
        <strong>Pricing &amp; Plans → Manage billing</strong> to update payment methods, view
        invoices, or cancel at period end.
      </p>

      <h2>Security</h2>
      <p>
        To report a suspected security issue, email{' '}
        <a className="legal-mail" href={mailHref}>
          {SUPPORT_EMAIL}
        </a>{' '}
        with “Security” in the subject line. Please do not include passwords or full card numbers.
      </p>
    </LegalPageLayout>
  );
}
