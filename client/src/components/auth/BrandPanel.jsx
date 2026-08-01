import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: 'fa-boxes', title: 'Inventory Tracking', subtitle: 'Real-time stock levels across all warehouses' },
  { icon: 'fa-ship', title: 'Shipment Management', subtitle: 'Track containers from China, Turkey, UAE & more' },
  { icon: 'fa-wallet', title: 'Multi-currency Finance', subtitle: 'Handle XAF, USD & EUR in one unified ledger' }
];

export default function BrandPanel() {
  return (
    <div className="brand-panel">
      <div className="brand-panel-bg" />
      <div className="brand-panel-grid" />
      <div className="brand-panel-content">
        <Link to="/login" className="brand-logo">
          <div className="brand-logo-text">CargoTrader</div>
          <div className="brand-logo-sub">ERP Platform</div>
        </Link>

        <div className="brand-illustration">
          <img
            src="/auth-brand-hero.jpg"
            alt="Container ship loaded at an international port with cranes and shipping containers"
            width="600"
            height="380"
            loading="eager"
          />
          <p className="brand-photo-credit">
            Photo by{' '}
            <a
              href="https://unsplash.com/@hamburgmeinefreundin"
              target="_blank"
              rel="noreferrer noopener"
            >
              Wolfgang Weiser
            </a>{' '}
            on Unsplash
          </p>
        </div>

        <div className="brand-headline">
          <h1>
            Manage your import business —
            <br />
            from source to store.
          </h1>
          <div className="feature-bullets">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-bullet">
                <div className="feature-icon">
                  <i className={`fas ${f.icon}`} />
                </div>
                <div className="feature-text">
                  <strong>{f.title}</strong>
                  <span>{f.subtitle}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="brand-currencies">
          <span className="brand-currencies-label">Supported</span>
          <div className="currency-chip-decor"><span className="currency-symbol">$</span> USD</div>
          <div className="currency-chip-decor"><span className="currency-symbol">€</span> EUR</div>
          <div className="currency-chip-decor"><span className="currency-symbol">₣</span> XAF</div>
        </div>
      </div>
    </div>
  );
}
