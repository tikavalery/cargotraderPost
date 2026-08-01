import { useMemo, useState } from 'react';

function supplierSelectId(s) {
  return s?.supplierId || s?.id || s?._id;
}

export function useSupplierSelection(visibleRows = []) {
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

  const visibleIds = useMemo(
    () => visibleRows.map(supplierSelectId).filter(Boolean),
    [visibleRows]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selectedIds.has(supplierSelectId(r))),
    [visibleRows, selectedIds]
  );

  return {
    selectedIds,
    toggleRow,
    toggleAll,
    clearSelection,
    count,
    allVisibleSelected,
    someVisibleSelected,
    selectedRows,
    visibleIds
  };
}
