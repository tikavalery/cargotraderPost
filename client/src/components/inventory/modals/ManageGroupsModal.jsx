import { useEffect, useState } from 'react';
import { inventoryItemsApi } from '../../../api';
import { useToast } from '../../../context/ToastContext';
import ModalShell from './ModalShell';

export default function ManageGroupsModal({ open, groups = [], onClose, onChanged }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState('');
  const [list, setList] = useState(groups);

  useEffect(() => {
    if (open) {
      setList(groups);
      setName('');
    }
  }, [open, groups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Enter a group name');
      return;
    }
    setSaving(true);
    try {
      const res = await inventoryItemsApi.createGroup({ name: trimmed });
      const created = res.data?.data?.name || trimmed;
      showToast(res.data?.message || 'Group created', 'success');
      setName('');
      setList((prev) =>
        [...new Set([...prev, created])].sort((a, b) => a.localeCompare(b))
      );
      await onChanged?.();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not create group');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (groupName) => {
    if (
      !window.confirm(
        `Delete group “${groupName}”? Items in this group will be set to Ungrouped.`
      )
    ) {
      return;
    }
    setRemoving(groupName);
    try {
      const res = await inventoryItemsApi.removeGroup(groupName);
      showToast(res.data?.message || 'Group deleted', 'success');
      setList((prev) => prev.filter((g) => g.toLowerCase() !== groupName.toLowerCase()));
      await onChanged?.();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove group');
    } finally {
      setRemoving('');
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Manage Groups"
      subtitle="Create groups to organize items. Deleting a group unassigns it from items."
      size="sm"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Done
        </button>
      }
    >
      <form className="inv-manage-groups-form" onSubmit={handleCreate}>
        <label className="form-label" htmlFor="inv-new-group-name">
          New group name
        </label>
        <div className="inv-manage-groups-add">
          <input
            id="inv-new-group-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bale-001, Summer Clothes"
            maxLength={80}
            disabled={saving}
          />
          <button type="submit" className="btn-add" disabled={saving || !name.trim()}>
            <i className="fas fa-plus" /> {saving ? 'Adding…' : 'Add Group'}
          </button>
        </div>
      </form>

      <div className="inv-manage-groups-list-wrap">
        <div className="form-label">Your groups ({list.length})</div>
        {list.length ? (
          <ul className="inv-manage-groups-list">
            {list.map((g) => (
              <li key={g}>
                <span title={g}>{g}</span>
                <button
                  type="button"
                  className="btn-action-icon delete"
                  onClick={() => handleRemove(g)}
                  disabled={removing === g}
                  aria-label={`Remove ${g}`}
                  title="Remove from list"
                >
                  <i className="fas fa-trash" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inv-manage-groups-empty">No groups yet. Add one above to get started.</p>
        )}
      </div>
    </ModalShell>
  );
}
