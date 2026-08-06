import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const showToast = vi.fn();
const refetch = vi.fn();
const remove = vi.fn();
const reloadUsage = vi.fn();

const { refreshTracking, updateStatus, getShipment } = vi.hoisted(() => ({
  refreshTracking: vi.fn(),
  updateStatus: vi.fn(),
  getShipment: vi.fn()
}));

let mockShipments = [];
let mockLoading = false;
let mockSearch = '';

vi.mock('../../layout/AppShell', () => ({
  default: function MockAppShell({ children, breadcrumbs, navbarRight }) {
    return (
      <div data-testid="app-shell">
        <nav data-testid="breadcrumbs">
          {(breadcrumbs || []).map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </nav>
        <div data-testid="navbar-right">{navbarRight}</div>
        {children}
      </div>
    );
  }
}));

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => (key, vars) => {
    if (!vars) return key;
    return String(key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  }
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'owner-1',
      name: 'Ada Owner',
      businessName: 'ThriftShip Cameroon',
      role: 'Business Owner'
    },
    loading: false
  })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../context/SearchContext', () => ({
  useSyncedSearch: () => ({ search: mockSearch })
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canManageShipments: true,
    canManageInventory: true,
    canViewCost: true,
    isOperationsReadOnly: false
  })
}));

vi.mock('../../hooks/usePlanUsage', () => ({
  usePlanUsage: () => ({
    planId: 'professional',
    shipmentLimit: 50,
    shipmentsUsed: 2,
    atShipmentLimit: false,
    reload: reloadUsage
  })
}));

vi.mock('../../hooks/useShipments', () => ({
  useShipments: () => ({
    shipments: mockShipments,
    pagination: { pages: 1, limit: 50, page: 1, total: mockShipments.length },
    loading: mockLoading,
    refetch,
    remove
  })
}));

vi.mock('../../services/shippingApi', () => ({
  shippingApi: {
    refreshTracking: (...a) => refreshTracking(...a),
    updateStatus: (...a) => updateStatus(...a),
    get: (...a) => getShipment(...a),
    getItems: vi.fn().mockResolvedValue({ data: { data: [] } })
  }
}));

vi.mock('../../utils/shipmentExport', () => ({
  exportShipmentsCsv: vi.fn(() => true),
  printShipmentsReport: vi.fn(() => true)
}));

vi.mock('../../components/plan/PlanLimitBanner', () => ({
  default: ({ label, used, limit }) => (
    <div data-testid="plan-limit-banner">
      {label}: {used} / {limit}
    </div>
  )
}));

vi.mock('../../components/AccountantReadOnlyNotice', () => ({
  default: () => null
}));

vi.mock('../../components/shipping/NewShipmentModal', () => ({
  default: function MockNewShipmentModal({ open, shipment, onClose, onCreated }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-label={shipment ? 'Edit shipment' : 'New shipment'}>
        <button
          type="button"
          onClick={() => {
            onCreated?.();
            onClose();
          }}
        >
          Save shipment
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
}));

vi.mock('../../components/shipping/ShipmentDetailModal', () => ({
  default: function MockShipmentDetailModal({ open, shipment, onClose, onMarkArrived }) {
    if (!open || !shipment) return null;
    return (
      <div role="dialog" aria-label="Shipment detail">
        <h2>{shipment.shipmentId}</h2>
        <p>{shipment.carrier}</p>
        {onMarkArrived ? (
          <button type="button" onClick={() => onMarkArrived(shipment)}>
            Mark as Arrived
          </button>
        ) : null}
        <button type="button" onClick={onClose}>
          Close detail
        </button>
      </div>
    );
  }
}));

import ActiveShipmentsPage from './ActiveShipmentsPage';
import { exportShipmentsCsv } from '../../utils/shipmentExport';

const sampleShipments = [
  {
    id: '1',
    shipmentId: 'SHP-100',
    status: 'In Transit',
    carrier: 'COSCO',
    origin: 'Guangzhou',
    originFlag: '🇨🇳',
    dest: 'Douala',
    destFlag: '🇨🇲',
    trackingNumber: 'COSCO123456',
    currentCity: 'Singapore',
    currentCountry: 'Singapore',
    currentLocation: 'Singapore',
    items: 12,
    eta: 'Jul 30',
    landedCostUsd: 1500,
    updated: '3h ago'
  },
  {
    id: '2',
    shipmentId: 'SHP-200',
    status: 'Delayed',
    carrier: 'Maersk',
    origin: 'Ningbo',
    originFlag: '🇨🇳',
    dest: 'Douala',
    destFlag: '🇨🇲',
    trackingNumber: 'MAEU998877',
    currentCity: 'Tema',
    currentCountry: 'Ghana',
    currentLocation: 'Tema, Ghana',
    items: 8,
    eta: 'Aug 5',
    landedCostUsd: 1100,
    updated: '1d ago'
  },
  {
    id: '3',
    shipmentId: 'SHP-300',
    status: 'At Customs',
    carrier: 'MSC',
    origin: 'Shanghai',
    originFlag: '🇨🇳',
    dest: 'Douala',
    destFlag: '🇨🇲',
    trackingNumber: 'MSCU554433',
    currentCity: 'Douala',
    currentCountry: 'Cameroon',
    currentLocation: 'Douala Port',
    items: 4,
    eta: 'Jul 22',
    landedCostUsd: 800,
    updated: '5h ago'
  }
];

function renderActiveShipments() {
  return render(
    <MemoryRouter initialEntries={['/shipping/active']}>
      <Routes>
        <Route path="/shipping/active" element={<ActiveShipmentsPage />} />
        <Route path="/shipping/documents" element={<div>Documents page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Active Shipments page (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShipments = sampleShipments.map((s) => ({ ...s }));
    mockLoading = false;
    mockSearch = '';
    refreshTracking.mockResolvedValue({ data: { ok: true, currentLocation: 'Singapore' } });
    updateStatus.mockResolvedValue({
      data: { data: { ...sampleShipments[0], status: 'Arrived' } }
    });
    getShipment.mockResolvedValue({ data: { data: sampleShipments[0] } });
    remove.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders logistics breadcrumbs, table headers, and shipment rows', async () => {
    renderActiveShipments();

    const crumbs = screen.getByTestId('breadcrumbs');
    expect(within(crumbs).getByText('Shipping')).toBeInTheDocument();
    expect(within(crumbs).getByText('Logistics')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Shipments & Logistics' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Shipment ID' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Location' })).toBeInTheDocument();

    expect(await screen.findByText('SHP-100')).toBeInTheDocument();
    expect(screen.getByText('SHP-200')).toBeInTheDocument();
    expect(screen.getByText('SHP-300')).toBeInTheDocument();
    expect(screen.getAllByText('COSCO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maersk').length).toBeGreaterThan(0);
  });

  it('filters the live table by status chip and status select', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-100');

    await user.click(screen.getByRole('button', { name: 'Delayed' }));

    await waitFor(() => {
      expect(screen.getByText('SHP-200')).toBeInTheDocument();
      expect(screen.queryByText('SHP-100')).not.toBeInTheDocument();
      expect(screen.queryByText('SHP-300')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.selectOptions(screen.getByDisplayValue('By Status'), 'At Customs');

    await waitFor(() => {
      expect(screen.getByText('SHP-300')).toBeInTheDocument();
      expect(screen.queryByText('SHP-100')).not.toBeInTheDocument();
      expect(screen.queryByText('SHP-200')).not.toBeInTheDocument();
    });
  });

  it('opens shipment detail from the row view action', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-100');
    const viewButtons = screen.getAllByRole('button', { name: 'View shipment' });
    await user.click(viewButtons[0]);

    const detail = await screen.findByRole('dialog', { name: 'Shipment detail' });
    expect(within(detail).getByRole('heading', { name: 'SHP-100' })).toBeInTheDocument();
    expect(within(detail).getByText('COSCO')).toBeInTheDocument();
  });

  it('selects rows and exports the selection via the bulk bar', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-100');

    const rowChecks = screen.getAllByRole('checkbox', { name: /Select shipment/i });
    expect(rowChecks.length).toBeGreaterThanOrEqual(2);

    await user.click(rowChecks[0]);
    await user.click(rowChecks[1]);

    expect(screen.getAllByText('2 selected').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Export Selected/i }));

    expect(exportShipmentsCsv).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ shipmentId: 'SHP-100' }),
        expect.objectContaining({ shipmentId: 'SHP-200' })
      ]),
      expect.objectContaining({ filename: 'active-shipments-selected-2.csv' })
    );
    expect(showToast).toHaveBeenCalledWith('Exported 2 selected shipment(s)', 'success');
  });

  it('bulk marks selected shipments as arrived', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-100');
    const rowChecks = screen.getAllByRole('checkbox', { name: /Select shipment/i });
    await user.click(rowChecks[0]);
    await user.click(rowChecks[1]);

    await user.click(screen.getByRole('button', { name: /Mark Arrived/i }));

    expect(window.confirm).toHaveBeenCalledWith('Mark 2 shipment(s) as Arrived?');

    await waitFor(() => {
      expect(updateStatus).toHaveBeenCalledTimes(2);
      expect(updateStatus).toHaveBeenCalledWith('SHP-100', {
        status: 'Arrived',
        note: 'Marked arrived (bulk)'
      });
      expect(showToast).toHaveBeenCalledWith('Marked 2 shipment(s) as arrived', 'success');
      expect(refetch).toHaveBeenCalled();
    });
  });

  it('creates a shipment through navbar New Shipment flow', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await user.click(screen.getAllByRole('button', { name: /New Shipment/i })[0]);
    expect(screen.getByRole('dialog', { name: 'New shipment' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save shipment' }));

    expect(refetch).toHaveBeenCalled();
    expect(reloadUsage).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'New shipment' })).not.toBeInTheDocument();
  });

  it('deletes a shipment from the table actions', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-200');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete shipment' });
    await user.click(deleteButtons[1]);

    expect(window.confirm).toHaveBeenCalledWith('Delete shipment SHP-200?');
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('SHP-200');
      expect(showToast).toHaveBeenCalledWith('Shipment deleted', 'success');
    });
  });

  it('filters by carrier select in the table controls', async () => {
    const user = userEvent.setup();
    renderActiveShipments();

    await screen.findByText('SHP-100');
    await user.selectOptions(screen.getByDisplayValue('By Carrier'), 'MSC');

    await waitFor(() => {
      expect(screen.getByText('SHP-300')).toBeInTheDocument();
      expect(screen.queryByText('SHP-100')).not.toBeInTheDocument();
      expect(screen.queryByText('SHP-200')).not.toBeInTheDocument();
    });
  });
});
