/**
 * Shared table pagination — server-side page controls.
 * Layout inspired by common “Showing X–Y of Z · Previous · pages · Next” bars;
 * colors use app tokens (--primary, --secondary, --border).
 */
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

function buildPageWindow(page, pages, windowSize = 5) {
  if (pages <= windowSize) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = start + windowSize - 1;
  if (end > pages) {
    end = pages;
    start = Math.max(1, end - windowSize + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function TablePagination({
  page = 1,
  pages = 1,
  total = 0,
  pageSize = 25,
  onPage,
  onPageSize,
  pageSizes = DEFAULT_PAGE_SIZES,
  noun = 'records',
  showPageSize = true,
  disabled = false
}) {
  const safePages = Math.max(1, Number(pages) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safePages);
  const safeSize = Math.max(1, Number(pageSize) || 25);
  const safeTotal = Math.max(0, Number(total) || 0);
  const start = safeTotal === 0 ? 0 : (safePage - 1) * safeSize + 1;
  const end = Math.min(safePage * safeSize, safeTotal);
  const pageNums = buildPageWindow(safePage, safePages);
  const busy = Boolean(disabled);

  if (safeTotal === 0 && safePages <= 1) {
    return (
      <div className="tbl-pagination" role="navigation" aria-label="Pagination">
        <span className="tbl-pagination-info">Showing 0 {noun}</span>
      </div>
    );
  }

  return (
    <div className="tbl-pagination" role="navigation" aria-label="Pagination">
      <span className="tbl-pagination-info">
        Showing {start}–{end} of {safeTotal} {noun}
      </span>

      <div className="tbl-pagination-controls">
        <button
          type="button"
          className="tbl-pg-nav"
          disabled={busy || safePage <= 1}
          onClick={() => onPage?.(safePage - 1)}
        >
          Previous
        </button>

        <div className="tbl-pg-pages" role="group" aria-label="Page numbers">
          {pageNums.map((n) => (
            <button
              key={n}
              type="button"
              className={`tbl-pg-num${n === safePage ? ' is-active' : ''}`}
              disabled={busy}
              aria-current={n === safePage ? 'page' : undefined}
              onClick={() => onPage?.(n)}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="tbl-pg-next"
          disabled={busy || safePage >= safePages}
          onClick={() => onPage?.(safePage + 1)}
        >
          Next
        </button>
      </div>

      {showPageSize && onPageSize ? (
        <label className="tbl-pg-size">
          <span>Show</span>
          <select
            value={safeSize}
            disabled={busy}
            onChange={(e) => onPageSize?.(Number(e.target.value))}
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
