import TablePagination from '../common/TablePagination';

/** @deprecated Prefer TablePagination directly — kept as a thin wrapper for shipping pages. */
export default function ShipmentPagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
  onPageSize,
  noun = 'shipments',
  disabled = false
}) {
  return (
    <TablePagination
      page={page}
      pages={pages}
      total={total}
      pageSize={pageSize}
      onPage={onPage}
      onPageSize={onPageSize}
      noun={noun}
      showPageSize={Boolean(onPageSize)}
      disabled={disabled}
    />
  );
}
