import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffTableActions from '../../components/settings/StaffTableActions';

describe('StaffTableActions (unit)', () => {
  const owner = { id: 'o1', role: 'Business Owner', name: 'Owner' };
  const clerk = { id: 'c1', role: 'Store Clerk', name: 'Clerk' };
  const currentOwner = { id: 'o1', role: 'Business Owner' };
  const currentManager = { id: 'm1', role: 'Manager' };

  it('allows view/edit/delete for editable staff when current user is owner', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <StaffTableActions
        row={clerk}
        currentUser={currentOwner}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onView).toHaveBeenCalledWith(clerk);
    expect(onEdit).toHaveBeenCalledWith(clerk);
    expect(onDelete).toHaveBeenCalledWith(clerk);
  });

  it('disables edit/delete for Business Owner rows', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <StaffTableActions
        row={owner}
        currentUser={currentOwner}
        onView={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const edit = screen.getByRole('button', { name: 'Edit' });
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(edit).toHaveClass('is-disabled');
    expect(del).toHaveClass('is-disabled');
    expect(edit).toHaveAttribute('title', 'Cannot edit business owner');

    await user.click(edit);
    await user.click(del);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('disables edit/delete when a manager targets their own row', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const selfManager = { id: 'm1', role: 'Manager', name: 'Me' };

    render(
      <StaffTableActions
        row={selfManager}
        currentUser={currentManager}
        onView={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toHaveClass('is-disabled');
    expect(edit).toHaveAttribute('title', 'Managers cannot edit their own record');
    await user.click(edit);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
