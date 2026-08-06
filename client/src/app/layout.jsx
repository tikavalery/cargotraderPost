import Providers from './providers';
import '../styles/auth.css';
import '../styles/inventory.css';
import '../styles/item-detail.css';
import '../styles/purchases.css';
import '../styles/warehouses.css';
import '../styles/shipping.css';
import '../styles/stores.css';
import '../styles/finance.css';
import '../styles/dashboard.css';
import '../styles/navbar-user.css';
import '../styles/pricing.css';
import '../styles/billing.css';
import '../styles/tables.css';
import '../styles/responsive-tables.css';
import '../styles/pagination.css';
/* After tables.css so Users & Staff / settings overrides win */
import '../styles/settings.css';

export const metadata = {
  title: 'CargoTrader',
  description: 'CargoTrader ERP'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
