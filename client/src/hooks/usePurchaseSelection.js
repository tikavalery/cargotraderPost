import { useMemo, useState } from 'react';

export function usePurchaseSelection(visibleRows = []) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids) => {
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const count = selectedIds.size;

  const firstSelectedId = () => {
    for (const id of selectedIds) return id;
    return null;
  };

  const visibleIds = useMemo(() => visibleRows.map((r) => r.selectId || r.id), [visibleRows]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(r.selectId || r.id)),
    [visibleRows, selectedIds]
  );

  return {
    selectedIds,
    toggleRow,
    toggleAll,
    clearSelection,
    count,
    firstSelectedId,
    allVisibleSelected,
    someVisibleSelected,
    selectedRows,
    visibleIds
  };
}
