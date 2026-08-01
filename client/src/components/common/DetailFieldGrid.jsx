export default function DetailFieldGrid({ fields = [] }) {
  if (!fields.length) return null;
  return (
    <div className="at-detail-field-grid">
      {fields.map(({ label, value }) => (
        <div key={label} className="at-detail-field">
          <div className="at-detail-field-label">{label}</div>
          <div className="at-detail-field-value">{value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}
