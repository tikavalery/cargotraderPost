import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { filterShipments } from '../../utils/shipmentStatusBadge';

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
let mockPermissions = {
  canManageShipments: true,
  canManageInventory: true,
  canViewCost: true,
  isOperationsReadOnly: false
};
let mockUsage = {
  planId: 'professional',
  shipmentLimit: 50,
  shipmentsUsed: 2,
  atShipmentLimit: false,
  reload: reloadUsage
};
let mockSearch = '';

vi.mock('../../layout/AppShell', () => ({
  default: function MockAppShell({ children, navbarRight }) {
    return (
      <div data-testid="app-shell">
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
    user: { id: 'u1', name: 'Ada Owner', businessName: 'Test Logistics Co', role: 'Business Owner' }
  })
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast })
}));

vi.mock('../../context/SearchContext', () => ({
  useSyncedSearch: () => ({ search: mockSearch })
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => mockPermissions
}));

vi.mock('../../hooks/usePlanUsage', () => ({
  usePlanUsage: () => mockUsage
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
    get: (...a) => getShipment(...a)
  }
}));

vi.mock('../../utils/shipmentExport', () => ({
  exportShipmentsCsv: vi.fn(() => true),
  printShipmentsReport: vi.fn(() => true)
}));

vi.mock('../../components/plan/PlanLimitBanner', () => ({
  default: function MockPlanLimitBanner({ label, used, limit }) {
    if (limit == null) return null;
    return (
      <div data-testid="plan-limit-banner">
        {label}: {used} / {limit}
      </div>
    );
  }
}));

vi.mock('../../components/AccountantReadOnlyNotice', () => ({
  default: () => null
}));

vi.mock('../../components/shipping/ShipmentPagination', () => ({
  default: function MockPagination({ total }) {
    return <div data-testid="pagination">Total {total}</div>;
  }
}));

vi.mock('../../components/shipping/ShipmentsTable', () => ({
  default: function MockShipmentsTable({
    shipments,
    loading,
    onView,
    onEdit,
    onDelete,
    selection,
    bulkBar,
    selectable
  }) {
    if (loading) return <div>Loading…</div>;
    return (
      <div data-testid="shipments-table">
        {selectable && selection?.count > 0 ? bulkBar : null}
        <ul>
          {shipments.map((s) => {
            const id = s.selectId || s.shipmentId || s.id;
            return (
              <li key={id}>
                <span>{s.shipmentId}</span>
                <button type="button" onClick={() => onView?.(s)}>
                  View {s.shipmentId}
                </button>
                {onEdit ? (
                  <button type="button" onClick={() => onEdit(s)}>
                    Edit {s.shipmentId}
                  </button>
                ) : null}
                {onDelete ? (
                  <button type="button" onClick={() => onDelete(s)}>
                    Delete {s.shipmentId}
                  </button>
                ) : null}
                {selectable ? (
                  <button type="button" onClick={() => selection.toggleRow(id)}>
                    Select {s.shipmentId}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!shipments.length ? <p>No shipments found</p> : null}
      </div>
    );
  }
}));

vi.mock('../../components/shipping/NewShipmentModal', () => ({
  default: function MockNewShipmentModal({ open, shipment, onClose }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-label={shipment ? 'Edit shipment' : 'New shipment'}>
        <p>{shipment ? `Editing ${shipment.shipmentId}` : 'Create form'}</p>
        <button type="button" onClick={onClose}>
          Close modal
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
        <p>Detail {shipment.shipmentId}</p>
        {onMarkArrived ? (
          <button type="button" onClick={() => onMarkArrived(shipment)}>
            Mark arrived
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
    shipmentId: 'SHP-001',
    status: 'In Transit',
    carrier: 'COSCO',
    origin: 'Guangzhou',
    dest: 'Douala',
    trackingNumber: 'TRACK001234',
    currentCity: 'Singapore',
    currentCountry: 'SG',
    eta: 'Jul 30',
    landedCostUsd: 1200,
    updated: '2h ago'
  },
  {
    id: '2',
    shipmentId: 'SHP-002',
    status: 'Delayed',
    carrier: 'MSC',
    origin: 'Shenzhen',
    dest: 'Douala',
    trackingNumber: 'TRACK005678',
    currentCity: 'Lagos',
    currentCountry: 'NG',
    eta: 'Aug 2',
    landedCostUsd: 980,
    updated: '1d ago'
  }
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ActiveShipmentsPage />
    </MemoryRouter>
  );
}

describe('filterShipments (active page helpers)', () => {
  it('filters by status chip, carrier, and search', () => {
    expect(filterShipments(sampleShipments, { statusChip: 'Delayed' })).toHaveLength(1);
    expect(filterShipments(sampleShipments, { statusChip: 'Active' })).toHaveLength(1);
    expect(filterShipments(sampleShipments, { carrierFilter: 'msc' })[0].shipmentId).toBe('SHP-002');
    expect(filterShipments(sampleShipments, { search: 'SHP-001' })).toHaveLength(1);
  });
});

describe('ActiveShipmentsPage (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShipments = [...sampleShipments];
    mockLoading = false;
    mockSearch = '';
    mockPermissions = {
      canManageShipments: true,
      canManageInventory: true,
      canViewCost: true,
      isOperationsReadOnly: false
    };
    mockUsage = {
      planId: 'professional',
      shipmentLimit: 50,
      shipmentsUsed: 2,
      atShipmentLimit: false,
      reload: reloadUsage
    };
    refreshTracking.mockResolvedValue({ data: { ok: true } });
    remove.mockResolvedValue({});
    updateStatus.mockResolvedValue({ data: { data: { ...sampleShipments[0], status: 'Arrived' } } });
    getShipment.mockResolvedValue({ data: { data: sampleShipments[0] } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page heading, business subtitle, plan banner, and shipments', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Shipments & Logistics' })).toBeInTheDocument();
    expect(screen.getByText(/Test Logistics Co/)).toBeInTheDocument();
    expect(screen.getByTestId('plan-limit-banner')).toHaveTextContent('Shipments this year: 2 / 50');
    expect(screen.getByText('SHP-001')).toBeInTheDocument();
    expect(screen.getByText('SHP-002')).toBeInTheDocument();
    expect(screen.getByTestId('pagination')).toHaveTextContent('Total 2');
  });

  it('shows delayed alert and filters to Delayed when Review is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/1 shipment is delayed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review →' }));

    await waitFor(() => {
      expect(screen.queryByText('SHP-001')).not.toBeInTheDocument();
      expect(screen.getByText('SHP-002')).toBeInTheDocument();
    });
  });

  it('blocks New Shipment when at plan limit', async () => {
    const user = userEvent.setup();
    mockUsage = { ...mockUsage, atShipmentLimit: true, shipmentLimit: 2, shipmentsUsed: 2 };
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /New Shipment/i })[0]);

    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/plan allows 2 shipments per year/i)
    );
    expect(screen.queryByRole('dialog', { name: 'New shipment' })).not.toBeInTheDocument();
  });

  it('opens New Shipment modal when under limit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /New Shipment/i })[0]);

    expect(screen.getByRole('dialog', { name: 'New shipment' })).toBeInTheDocument();
    expect(screen.getByText('Create form')).toBeInTheDocument();
  });

  it('opens detail modal when a shipment is viewed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'View SHP-001' }));

    expect(screen.getByRole('dialog', { name: 'Shipment detail' })).toHaveTextContent('Detail SHP-001');
  });

  it('deletes a shipment after confirm', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete SHP-001' }));

    expect(window.confirm).toHaveBeenCalledWith('Delete shipment SHP-001?');
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('SHP-001');
      expect(showToast).toHaveBeenCalledWith('Shipment deleted', 'success');
    });
  });

  it('exports all filtered shipments', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Export All Shipments/i }));

    expect(exportShipmentsCsv).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ shipmentId: 'SHP-001' }),
        expect.objectContaining({ shipmentId: 'SHP-002' })
      ]),
      expect.objectContaining({ filename: 'active-shipments-2.csv' })
    );
    expect(showToast).toHaveBeenCalledWith('Exported 2 shipment(s)', 'success');
  });

  it('hides manage actions when user cannot manage shipments', () => {
    mockPermissions = {
      ...mockPermissions,
      canManageShipments: false
    };
    renderPage();

    expect(screen.queryByRole('button', { name: /New Shipment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit SHP-001' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete SHP-001' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View SHP-001' })).toBeInTheDocument();
  });

  it('marks shipment arrived from detail modal', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'View SHP-001' }));
    await user.click(screen.getByRole('button', { name: 'Mark arrived' }));

    await waitFor(() => {
      expect(updateStatus).toHaveBeenCalledWith('SHP-001', {
        status: 'Arrived',
        note: 'Marked arrived'
      });
      expect(showToast).toHaveBeenCalledWith('Shipment marked as arrived', 'success');
      expect(refetch).toHaveBeenCalled();
    });
  });

  it('shows bulk actions after selecting a row', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Select SHP-001' }));

    const bulk = screen.getByText('1 selected').closest('.stock-bulk-bar');
    expect(bulk).toBeTruthy();
    expect(within(bulk).getByRole('button', { name: /Export Selected/i })).toBeInTheDocument();
    expect(within(bulk).getByRole('button', { name: /Mark Arrived/i })).toBeInTheDocument();
    expect(within(bulk).getByRole('button', { name: /Delete Selected/i })).toBeInTheDocument();
  });
});
