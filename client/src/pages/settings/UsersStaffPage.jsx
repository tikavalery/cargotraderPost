import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { staffApi } from '../../services/staffApi';
import InviteUserModal from '../../components/settings/InviteUserModal';
import StaffTableActions from '../../components/settings/StaffTableActions';
import { canModifyStaff } from '../../utils/permissions';
import ViewStaffModal from '../../components/settings/ViewStaffModal';
import EditStaffModal from '../../components/settings/EditStaffModal';
import DeleteStaffConfirmModal from '../../components/settings/DeleteStaffConfirmModal';
import Td from '../../components/common/Td';
import UserLimitBanner from '../../components/plan/UserLimitBanner';
import { usePlanUsage } from '../../hooks/usePlanUsage';

function staffId(record) {
  return record?.id || record?._id;
}

function RoleBadge({ role }) {
  const colors = {
    'Business Owner': '#E85D26',
    'Store Clerk': '#27AE60',
    'Warehouse Worker': '#1A3C5E',
    Accountant: '#8E44AD',
    Admin: '#E74C3C',
    Manager: '#3498DB'
  };
  const color = colors[role] || '#4A5568';
  return (
    <span className="settings-role-badge" style={{ background: `${color}18`, color }}>
      {role}
    </span>
  );
}

function assignmentLabel(record) {
  if (record.role === 'Store Clerk') return record.assignedStoreName || '—';
  if (record.role === 'Warehouse Worker') {
    return record.assignedWarehousesLabel || record.assignedWarehouseNames?.join(', ') || '—';
  }
  return '—';
}

function StatusPill({ active }) {
  return (
    <span className={`settings-status-pill${active ? ' active' : ' inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function UsersStaffPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    userLimit,
    atUserLimit,
    reload: reloadUsage
  } = usePlanUsage();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [viewType, setViewType] = useState('user');
  const [editRecord, setEditRecord] = useState(null);
  const [editType, setEditType] = useState('user');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('user');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, invRes, rolesRes] = await Promise.all([
        staffApi.listUsers(),
        staffApi.listInvitations(),
        staffApi.listRoles()
      ]);
      setUsers((usersRes.data.data || []).filter((u) => u.role !== 'Individual Seller' && u.role !== 'Viewer'));
      setInvitations(
        (invRes.data.data || []).filter(
          (i) =>
            i.status === 'pending' && i.role !== 'Individual Seller' && i.role !== 'Viewer'
        )
      );
      setRoles(
        (rolesRes.data.data || []).filter((r) => r !== 'Individual Seller' && r !== 'Viewer')
      );
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openView = (record, type) => {
    setViewRecord(record);
    setViewType(type);
  };

  const openEdit = (record, type) => {
    if (type === 'user' && !canModifyStaff(record, user)) {
      showToast(
        record?.role === 'Business Owner'
          ? 'Cannot edit the business owner'
          : 'Managers cannot edit their own record'
      );
      return;
    }
    setEditRecord(record);
    setEditType(type);
  };

  const requestDelete = (record, type) => {
    if (type === 'user' && !canModifyStaff(record, user)) {
      showToast(
        record?.role === 'Business Owner'
          ? 'Cannot remove the business owner'
          : 'Managers cannot remove their own record'
      );
      return;
    }
    setDeleteTarget(record);
    setDeleteType(type);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = staffId(deleteTarget);
    if (!id) {
      showToast('Invalid record — refresh and try again');
      return;
    }
    setDeleting(true);
    try {
      if (deleteType === 'invitation') {
        await staffApi.revokeInvitation(id);
        showToast('Invitation revoked', 'success');
      } else {
        await staffApi.deleteUser(id);
        showToast('User removed', 'success');
      }
      setDeleteTarget(null);
      reloadUsage();
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to remove');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (payload) => {
    setSaving(true);
    try {
      if (editType === 'invitation') {
        await staffApi.updateInvitation(staffId(editRecord), payload);
        showToast('Invitation updated', 'success');
      } else {
        await staffApi.updateUser(staffId(editRecord), payload);
        showToast('User updated', 'success');
      }
      setEditRecord(null);
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (inv) => {
    try {
      const res = await staffApi.resendInvitation(inv.id);
      showToast(res.data.message || 'Invitation resent', 'success');
      if (res.data.inviteUrl) console.info('Invite link:', res.data.inviteUrl);
      setViewRecord(null);
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to resend invitation');
    }
  };

  const openInvite = () => {
    if (atUserLimit) {
      showToast(
        userLimit != null
          ? `Your plan allows up to ${userLimit} users. Existing users are kept — upgrade or remove someone to invite more.`
          : 'User limit reached. Upgrade your plan to invite more.'
      );
      return;
    }
    setInviteOpen(true);
  };

  const handleInvited = async (result) => {
    setInviteOpen(false);
    showToast(result.message || 'Invitation sent', 'success');
    if (result.inviteUrl) console.info('Invite link:', result.inviteUrl);
    reloadUsage();
    await load();
  };

  const pendingInvites = invitations.filter(
    (i) => i.status === 'pending' && new Date(i.expiresAt) > new Date()
  );

  return (
    <div className="settings-users-page">
      <div className="page-header settings-users-header page-chrome-dense">
        <div className="settings-users-header-text">
          <h1 className="settings-users-title">Users &amp; Staff</h1>
          <p className="page-sub settings-users-sub page-chrome-dense-hide">
            Invite team members, assign roles, stores, and warehouses
          </p>
        </div>
        <div className="header-btns settings-users-header-actions">
          <button
            type="button"
            className="btn-add settings-invite-btn"
            onClick={openInvite}
            disabled={atUserLimit}
            title={
              atUserLimit
                ? 'User limit reached — upgrade or remove a user to invite more'
                : 'Invite User'
            }
            aria-label="Invite User"
          >
            <i className="fas fa-user-plus" />
            <span className="settings-chrome-label">Invite User</span>
          </button>
        </div>
      </div>

      <UserLimitBanner />

      {loading ? (
        <p className="settings-empty"><i className="fas fa-spinner fa-spin" /> Loading…</p>
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <section className="settings-section settings-users-section">
              <h2 className="settings-section-title settings-users-section-title">
                Pending invitations
              </h2>
              <div className="table-card settings-users-table-card">
                <div className="table-scroll-x">
                  <table className="settings-table at-responsive-table settings-users-table">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Role</th>
                        <th>Assignment</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites.map((inv) => (
                        <tr key={inv.id}>
                          <Td label="Contact" className="settings-contact-cell">
                            {inv.email || inv.phone}
                          </Td>
                          <Td label="Role"><RoleBadge role={inv.role} /></Td>
                          <Td label="Assignment" className="settings-assignment-cell">
                            {assignmentLabel(inv)}
                          </Td>
                          <Td label="Expires">{new Date(inv.expiresAt).toLocaleDateString()}</Td>
                          <Td label="Actions" className="at-card-actions">
                            <StaffTableActions
                              row={inv}
                              currentUser={user}
                              onView={(r) => openView(r, 'invitation')}
                              onEdit={(r) => openEdit(r, 'invitation')}
                              onDelete={(r) => requestDelete(r, 'invitation')}
                            />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="settings-section settings-users-section">
            <h2 className="settings-section-title settings-users-section-title">
              Team members ({users.length})
            </h2>
            <div className="table-card settings-users-table-card">
              <div className="table-scroll-x">
                <table className="settings-table at-responsive-table settings-users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / Phone</th>
                      <th>Role</th>
                      <th>Assignment</th>
                      <th>Status</th>
                      <th>Last login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={7} className="settings-empty-cell" data-label="">
                          No team members yet
                        </td>
                      </tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id}>
                        <Td label="Name" className="settings-name-cell">{u.name}</Td>
                        <Td label="Email / Phone" className="settings-contact-cell">
                          {u.email || u.phone || '—'}
                        </Td>
                        <Td label="Role"><RoleBadge role={u.role} /></Td>
                        <Td label="Assignment" className="settings-assignment-cell">
                          {assignmentLabel(u)}
                        </Td>
                        <Td label="Status"><StatusPill active={u.isActive !== false} /></Td>
                        <Td label="Last login" className="settings-login-cell">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                        </Td>
                        <Td label="Actions" className="at-card-actions">
                          <StaffTableActions
                            row={u}
                            currentUser={user}
                            onView={(r) => openView(r, 'user')}
                            onEdit={(r) => openEdit(r, 'user')}
                            onDelete={(r) => requestDelete(r, 'user')}
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      <InviteUserModal
        open={inviteOpen}
        roles={roles}
        onClose={() => setInviteOpen(false)}
        onInvited={handleInvited}
        atUserLimit={atUserLimit}
      />

      <ViewStaffModal
        open={!!viewRecord}
        record={viewRecord}
        type={viewType}
        onClose={() => setViewRecord(null)}
        onResend={viewType === 'invitation' ? handleResend : undefined}
      />

      <EditStaffModal
        open={!!editRecord}
        record={editRecord}
        type={editType}
        roles={roles}
        saving={saving}
        onClose={() => setEditRecord(null)}
        onSave={handleSaveEdit}
      />

      <DeleteStaffConfirmModal
        open={!!deleteTarget}
        record={deleteTarget}
        type={deleteType}
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
