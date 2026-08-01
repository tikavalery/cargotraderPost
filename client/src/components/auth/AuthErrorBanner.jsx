export default function AuthErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="auth-error" role="alert">
      {message}
    </div>
  );
}
