import { Link } from 'react-router-dom';
import LegalPageLayout from './LegalPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how CargoTrader (“we”, “us”) collects, uses, and
        shares information when you use our website and application (the “Service”).
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, email, password (hashed), business profile,
          preferred currency, and role information.
        </li>
        <li>
          <strong>Business operations data</strong> — inventory, purchases, warehouses, shipments,
          store/POS transactions, and finance records you enter into the Service.
        </li>
        <li>
          <strong>Billing data</strong> — subscription plan, Stripe customer/subscription
          identifiers, and payment status. Card details are processed by Stripe and are not stored
          on our servers.
        </li>
        <li>
          <strong>Technical data</strong> — IP address, device/browser information, and basic
          usage logs needed to operate and secure the Service.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide, secure, and improve the Service</li>
        <li>Authenticate users and enforce roles and plan limits</li>
        <li>Process subscriptions, send billing notices, and handle support requests</li>
        <li>Comply with legal obligations and prevent abuse</li>
      </ul>

      <h2>3. Sharing</h2>
      <p>We share data only as needed to run the Service, including with:</p>
      <ul>
        <li>
          <strong>Stripe</strong> — subscription payments, invoices, and tax calculation when enabled
        </li>
        <li>
          <strong>Email delivery providers</strong> — transactional messages (invites, password
          reset, billing notices) when SMTP is configured
        </li>
        <li>
          <strong>Cloud storage / optional integrations</strong> — for example image hosting or
          carrier tracking providers you enable
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>4. International processing and currency</h2>
      <p>
        The Service may be hosted or processed in regions outside your country. Subscription
        billing is in USD via Stripe; operational amounts inside the app may use your preferred
        business currency (such as XAF).
      </p>

      <h2>5. Retention</h2>
      <p>
        We retain account and business data while your account is active and for a reasonable
        period afterward for backups, dispute resolution, and legal compliance. You may request
        deletion of your account by contacting support, subject to legal retention requirements.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures such as encrypted transport (HTTPS), hashed passwords,
        and access controls. No method of transmission or storage is completely secure.
      </p>

      <h2>7. Your choices</h2>
      <p>
        You can update profile settings in the app, manage billing through Stripe’s Customer Portal
        when available, and contact us to request access or deletion of personal data where
        applicable.
      </p>

      <h2>8. Contact</h2>
      <p>
        Privacy questions: <Link to="/contact">Contact Support</Link>. See also our{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalPageLayout>
  );
}
