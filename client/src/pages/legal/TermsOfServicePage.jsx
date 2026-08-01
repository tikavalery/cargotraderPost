import { Link } from 'react-router-dom';
import LegalPageLayout from './LegalPageLayout';

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of CargoTrader
        (the “Service”), operated by CargoTrader. By creating an account or using the Service,
        you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        CargoTrader is a business operations platform for inventory, purchasing,
        warehouses, shipping, stores/POS, and related finance tools. Features available to you
        depend on your subscription plan and usage limits.
      </p>

      <h2>2. Accounts and businesses</h2>
      <p>
        You must provide accurate registration information and keep your credentials secure.
        You are responsible for activity under your account and for users you invite to your
        business. You must be authorized to act for any business you create or manage.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <p>
        Paid plans are billed in <strong>United States dollars (USD)</strong> through Stripe,
        even if you track inventory or sales in another currency (for example XAF) inside the
        app. Prices shown on the Pricing page are subscription fees in USD before any applicable
        taxes Stripe calculates at checkout when tax collection is enabled.
      </p>
      <p>
        Free plans may include limited usage caps. Upgrades, downgrades, trials, renewals, and
        cancellations are managed through the Service and Stripe’s Customer Portal where available.
        Downgrades typically take effect at the end of the current billing period; existing data
        is retained under our grandfather policy, but creating new records may be blocked until
        you are within plan limits.
      </p>

      <h2>4. Trials, cancellation, and refunds</h2>
      <p>
        When offered, free trials require a payment method. You can cancel before the trial ends
        to avoid the first charge. You may cancel a paid subscription at any time; access continues
        until the end of the paid period unless otherwise stated.
      </p>
      <p>
        Subscription fees are generally non-refundable for the current billing period once charged,
        except where required by law or when we determine a refund is appropriate (for example,
        a proven billing error). Contact support via the <Link to="/contact">Contact</Link> page
        for billing questions.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You may not misuse the Service, attempt unauthorized access, interfere with other
        customers, upload unlawful content, or use the Service in violation of applicable law.
        We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>6. Data and privacy</h2>
      <p>
        How we collect and process personal data is described in our{' '}
        <Link to="/privacy">Privacy Policy</Link>. You remain responsible for business data you
        enter into the Service and for obtaining any consents required for your staff and customers.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We aim for reliable availability but do not guarantee uninterrupted service. We may
        update features, plan limits, or these Terms. Material changes will be posted on this page
        with an updated date. Continued use after changes become effective constitutes acceptance.
      </p>

      <h2>8. Disclaimer and liability</h2>
      <p>
        The Service is provided “as is” to the fullest extent permitted by law. CargoTrader is not
        liable for indirect, incidental, or consequential damages, or for losses arising from
        shipping carriers, payment processors, or third-party services integrated with the app.
        Our aggregate liability for claims relating to the Service is limited to the subscription
        fees you paid to us for the Service in the three months before the claim.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms: <Link to="/contact">Contact Support</Link>.
      </p>
    </LegalPageLayout>
  );
}
