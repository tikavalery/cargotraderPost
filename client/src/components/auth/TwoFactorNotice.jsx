export default function TwoFactorNotice({ variant = 'register' }) {
  const text =
    variant === 'register'
      ? 'Two-factor authentication will be set up after account creation to keep your business data secure.'
      : "Two-factor authentication is enabled on your account. You'll receive a verification code after sign-in.";

  return (
    <div className="twofa-notice">
      <i className="fas fa-shield-alt" />
      <p>{text}</p>
    </div>
  );
}
