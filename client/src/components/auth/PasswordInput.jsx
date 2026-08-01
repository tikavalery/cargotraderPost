import { useState } from 'react';

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  onKeyDown,
  disabled = false
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="input-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="form-input has-right-icon"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        className="input-right-icon"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
      >
        <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
      </button>
    </div>
  );
}
