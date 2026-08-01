import { CATEGORY_GROUPS, INVENTORY_CATEGORIES } from '../../constants/categories';

/** Grouped options for form category fields */
export function CategorySelectOptions({ includeEmpty = false, emptyLabel = 'Select category…' }) {
  return (
    <>
      {includeEmpty && <option value="">{emptyLabel}</option>}
      {CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Grouped options for filter bars (All + optgroups) */
export function CategoryFilterOptions({
  allLabel = 'All Categories',
  allValue = '',
  includeAll = true
}) {
  return (
    <>
      {includeAll && <option value={allValue}>{allLabel}</option>}
      {CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Flat list for POS and compact filters */
export function CategoryFilterOptionsFlat({
  allLabel = 'All',
  allValue = 'All',
  includeAll = true,
  labelFn
}) {
  const label = typeof labelFn === 'function' ? labelFn : (value) => value;
  return (
    <>
      {includeAll && <option value={allValue}>{allLabel}</option>}
      {INVENTORY_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {label(c)}
        </option>
      ))}
    </>
  );
}
