export default function PurchaseFormSection({ icon, title, children, className = '' }) {
  return (
    <section className={`pur-form-section${className ? ` ${className}` : ''}`}>
      <h3 className="section-label">
        <i className={`fas ${icon}`} /> {title}
      </h3>
      <div className="pur-form-section-body">{children}</div>
    </section>
  );
}
