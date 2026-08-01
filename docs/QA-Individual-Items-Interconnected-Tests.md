# QA Script — Inventory → Individual Items (Interconnected Tests)

**App area:** Inventory → Individual Items (`/inventory/items`)  
**Purpose:** Confirm page features work and correctly update related modules.  
**How to use:** Fill the blanks as you test. Mark **Pass / Fail**. Note anything unexpected in **Notes**.

| Tester | Date | Role used | Environment (local / staging / prod) |
|--------|------|-----------|--------------------------------------|
|        |      |           |                                      |

---

## Before you start

1. Use a **test business** or items you can safely edit/delete.
2. Open these pages in separate tabs (helps compare before/after):
   - Inventory → Individual Items
   - Inventory → Quick Stats (if available)
   - Warehouses → open the warehouse that holds your test item
   - Stores → Store Inventory for the store that holds your test item
   - Stores → POS (same store)
   - Finance → Expenses or relevant finance view
   - Inventory → Inbound/Outbound Activity Log
   - Purchasing → All Purchases
3. Prefer items with simple numbers (e.g. qty **10**, prices like **5000** / **6000**) so math is easy to check.
4. After each save, **refresh** the related page if it does not auto-update.

**Formula to remember**

```
Inventory value for an item = Quantity × Target price
Change in value             = Quantity × (New target − Old target)
```

---

# SECTION A — Cross-module tests (highest priority)

---

## Test A1 — Edit target price → inventory value math

**Goal:** Changing target price recalculates value correctly and updates selling-price views, without changing finance COGS.

### Pick an item

| Field | Value |
|-------|-------|
| Item name | |
| SKU / Item ID | |
| Where it lives now (warehouse / store / transit) | |

### Before (record exact numbers)

| Metric | Before |
|--------|--------|
| Quantity (qty) | |
| Target price | |
| Shown inventory value (if visible) | |
| Expected value = qty × target | |
| Inventory Quick Stats / Dashboard total value (optional) | |
| Finance expense / COGS total (optional snapshot) | |
| Warehouse row target price | |
| Store inventory target price | |
| POS sell price | |

### Action

1. Individual Items → select **this one item** → **Edit**
2. Change **Target price** only
3. Save

| Field | After edit |
|-------|------------|
| New target price | |
| Expected new value = qty × new target | |
| Expected value change = qty × (new − old) | |

### After (check each place)

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| Individual Items target price | = new target | | ☐ Pass ☐ Fail |
| Individual Items value | = qty × new target | | ☐ Pass ☐ Fail |
| Quick Stats / Dashboard contribution | moved by expected value change | | ☐ Pass ☐ Fail ☐ N/A |
| Warehouse stock target price | = new target | | ☐ Pass ☐ Fail ☐ N/A |
| Store inventory target price | = new target | | ☐ Pass ☐ Fail ☐ N/A |
| POS sell price | = new target | | ☐ Pass ☐ Fail ☐ N/A |
| Quantity | **unchanged** | | ☐ Pass ☐ Fail |
| Purchase price | **unchanged** | | ☐ Pass ☐ Fail |
| Finance expense / COGS total | **unchanged** (target ≠ COGS) | | ☐ Pass ☐ Fail ☐ N/A |

**Example fill-in (sample)**

| | Example |
|--|---------|
| Qty | 10 |
| Old target | 5,000 |
| Old value | 50,000 |
| New target | 6,000 |
| New value | 60,000 |
| Value change | +10,000 |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test A2 — Edit name / SKU / category / notes / photos

**Goal:** Shared item identity updates everywhere; stock and finance numbers stay put.

### Before

| Field | Before |
|-------|--------|
| Name | |
| SKU | |
| Category | |
| Qty | |
| Target price | |
| Purchase price | |

### Action

Change at least **name** (and optionally SKU/category/notes/photo) → Save.

### After

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| Individual Items | shows new name/SKU/category | | ☐ Pass ☐ Fail |
| Warehouse view | same updates | | ☐ Pass ☐ Fail ☐ N/A |
| Store inventory | same updates | | ☐ Pass ☐ Fail ☐ N/A |
| Shipment items (if linked) | same updates | | ☐ Pass ☐ Fail ☐ N/A |
| POS label | same name | | ☐ Pass ☐ Fail ☐ N/A |
| Qty / target / purchase price | **unchanged** | | ☐ Pass ☐ Fail |
| Finance totals | **unchanged** | | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test A3 — Edit location (placement change)

**Goal:** Item moves between warehouse/store listings without changing qty.  
**Note:** This is **not** the same as the formal Transfer button flow; Activity Log often will **not** show a transfer movement.

### Before

| Field | Before |
|-------|--------|
| Item | |
| Qty | |
| Current location label | |
| Visible in warehouse? (name) | |
| Visible in store? (name) | |
| Visible in POS? | |

### Action

Edit → change **Location** to a different warehouse or store → Save.

| Field | Planned new location |
|-------|----------------------|
| New location | |

### After

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| Qty | **same number** | | ☐ Pass ☐ Fail |
| Old warehouse/store list | item **gone** (or no longer listed there) | | ☐ Pass ☐ Fail |
| New warehouse/store list | item **appears** | | ☐ Pass ☐ Fail |
| POS for new store (if store) | item available | | ☐ Pass ☐ Fail ☐ N/A |
| POS for old store (if left a store) | item gone | | ☐ Pass ☐ Fail ☐ N/A |
| Activity Log | usually **no** formal transfer line | | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test A4 — Edit / clear group

### Before

| Field | Before |
|-------|--------|
| Item | |
| Current group | |

### Action

Edit → set group to _______________ → Save.  
Then filter Individual Items by that group.

| Check | Expected | Pass? |
|-------|----------|-------|
| Item shows new group on Individual Items | yes | ☐ Pass ☐ Fail |
| Group filter includes the item | yes | ☐ Pass ☐ Fail |
| Warehouse/store group label (if shown) matches | yes | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test A5 — Bulk delete item

**Goal:** Item is removed from live stock everywhere; Activity Log records outbound; KPIs drop.

### Before

| Field | Before |
|-------|--------|
| Item name / SKU | |
| Qty | |
| Approx. inventory total count | |
| Approx. inventory total value | |
| Visible in warehouse? | |
| Visible in store / POS? | |

### Action

Select item(s) → **Delete** → Confirm.

### After

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| Individual Items | gone | | ☐ Pass ☐ Fail |
| Warehouse stock | gone | | ☐ Pass ☐ Fail ☐ N/A |
| Store inventory | gone | | ☐ Pass ☐ Fail ☐ N/A |
| POS | cannot sell it | | ☐ Pass ☐ Fail ☐ N/A |
| Shipment cargo list (if it was there) | gone | | ☐ Pass ☐ Fail ☐ N/A |
| Activity Log | outbound / delete-style entry | | ☐ Pass ☐ Fail |
| Inventory count / value KPIs | decreased | | ☐ Pass ☐ Fail |
| Purchase history (All Purchases) | old purchase may still exist as history | | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test A6 — Manage Groups (create, assign, delete)

### A6.1 Create group

| Field | Value |
|-------|-------|
| New group name | |

| Check | Pass? |
|-------|-------|
| Appears in Individual Items group filter | ☐ Pass ☐ Fail |
| Appears in Edit item group dropdown | ☐ Pass ☐ Fail |

### A6.2 Assign two items to the group

| Item | Assigned? |
|------|-----------|
| Item 1: _______________ | ☐ |
| Item 2: _______________ | ☐ |

| Check | Pass? |
|-------|-------|
| Filter by group shows both | ☐ Pass ☐ Fail |

### A6.3 Delete the group

| Check | Expected | Pass? |
|-------|----------|-------|
| Group removed from filters/dropdowns | yes | ☐ Pass ☐ Fail |
| Item 1 becomes Ungrouped | yes | ☐ Pass ☐ Fail |
| Item 2 becomes Ungrouped | yes | ☐ Pass ☐ Fail |
| Same Ungrouped state on other screens (if group shown) | yes | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

# SECTION B — End-to-end chain (other modules → Individual Items)

Run this as one story with one test product if possible.

---

## Test B1 — Purchase / receive → appears on Individual Items

| Field | Value |
|-------|-------|
| Purchase ID / supplier | |
| Item name created | |
| Qty received | |
| Purchase price | |
| Target price | |
| Location received into | |

| Check | Expected | Pass? |
|-------|----------|-------|
| Item appears on Individual Items | yes | ☐ Pass ☐ Fail |
| Qty matches received qty | yes | ☐ Pass ☐ Fail |
| Purchase price correct | yes | ☐ Pass ☐ Fail |
| Target price correct | yes | ☐ Pass ☐ Fail |
| Shows under correct warehouse/store | yes | ☐ Pass ☐ Fail |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test B2 — Change purchase price on Purchases (not on Individual Items)

**Goal:** Cost is owned by Purchases/Finance; Individual Items edit keeps purchase price locked.

### Before

| Field | Before |
|-------|--------|
| Item | |
| Purchase price on Individual Items | |
| Purchase price on purchase record | |
| Finance-related total (optional) | |

### Action

1. On Individual Items Edit, confirm purchase price is **locked / not editable**
2. On **Purchasing → All Purchases**, change purchase price for that item/purchase
3. Return to Individual Items / item detail

### After

| Check | Expected | Pass? |
|-------|----------|-------|
| Purchase price locked on Individual Items edit form | yes | ☐ Pass ☐ Fail |
| Updated cost visible on item / purchase views as designed | yes | ☐ Pass ☐ Fail |
| Target price unchanged (unless you edited it separately) | yes | ☐ Pass ☐ Fail |
| Finance/COGS can update from purchase cost change | yes / as designed | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test B3 — Formal transfer (Warehouses / Store Transfer)

**Goal:** Official transfer updates placement on Individual Items.

### Before

| Field | Before |
|-------|--------|
| Item | |
| Qty | |
| From (warehouse/store) | |
| To (warehouse/store/shipment) | |
| Qty transferred | |

### After

| Check | Expected | Pass? |
|-------|----------|-------|
| Individual Items location/placement updated | yes | ☐ Pass ☐ Fail |
| Source location qty/listing updated | yes | ☐ Pass ☐ Fail |
| Destination listing shows item | yes | ☐ Pass ☐ Fail |
| Activity Log / location logs behave as designed for transfers | yes | ☐ Pass ☐ Fail ☐ N/A |

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

## Test B4 — POS sale reduces qty and value on Individual Items

### Before

| Field | Before |
|-------|--------|
| Item | |
| Qty | |
| Target price | |
| Value = qty × target | |
| Store / POS | |

### Action

Sell **N** units in POS (N = ______).

### Expected math

| Field | Expected after |
|-------|----------------|
| New qty = old qty − N | |
| New value = new qty × target | |
| Value drop = N × target | |

### After

| Check | Expected | Actual | Pass? |
|-------|----------|--------|-------|
| Individual Items qty | old − N | | ☐ Pass ☐ Fail |
| Individual Items value | new qty × target | | ☐ Pass ☐ Fail |
| Store inventory qty | matches | | ☐ Pass ☐ Fail |
| If qty hits 0 | item hidden / not sellable as designed | | ☐ Pass ☐ Fail ☐ N/A |

**Example:** qty 10, target 6,000, sell 1 → qty 9, value 54,000, drop 6,000.

**Notes:**

_________________________________________________________________

**Result:** ☐ Pass ☐ Fail   **Initials:** ______

---

# SECTION C — Local UI tests (this page mainly)

Mark quickly; still required for release confidence.

| # | Feature | Steps (short) | Expected | Pass? | Notes |
|---|---------|---------------|----------|-------|-------|
| C1 | Search | Search name/SKU | Matching rows only; page resets | ☐ | |
| C2 | Category filter | Choose category | Only that category | ☐ | |
| C3 | Location filter | Choose location | Only that location | ☐ | |
| C4 | Group / Ungrouped filter | Choose group or Ungrouped | Correct subset | ☐ | |
| C5 | Pagination | Change page & page size | Correct “Showing X–Y of Z” | ☐ | |
| C6 | Select / Select all | Tick rows | Bulk bar appears; actions enable | ☐ | |
| C7 | View item | Open View | Detail matches table | ☐ | |
| C8 | Scan QR | Scan in-stock item | List filters to that item; clear works | ☐ | |
| C9 | View QR | Open QR on row | Correct code for item | ☐ | |
| C10 | Export All | Export CSV | File downloads for current view | ☐ | |
| C11 | Export Selected | Select → export | Only selected rows | ☐ | |
| C12 | Print report | Print inventory report | Print preview opens | ☐ | |
| C13 | Print labels | Select → print labels | Labels print (allow pop-ups) | ☐ | |
| C14 | Read-only role | Login as clerk/accountant if available | Can view/export; cannot edit/delete | ☐ | |
| C15 | Cost permission | User without cost view | Cost columns hidden in table/export | ☐ | |

---

# SECTION D — Final sign-off

| Area | Overall | Comments |
|------|---------|----------|
| A — Cross-module edits/deletes/groups | ☐ Pass ☐ Fail | |
| B — Purchases / Transfer / POS chain | ☐ Pass ☐ Fail | |
| C — Local UI | ☐ Pass ☐ Fail | |
| **Release recommendation** | ☐ Ready ☐ Not ready | |

**Blockers found:**

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

**Tester signature:** ______________________ **Date:** ______________

---

## Quick reference card (print this page alone if needed)

| If you change… | Should update… | Should usually NOT update… |
|----------------|----------------|----------------------------|
| Target price | Item value, KPIs, warehouse/store/POS price | Finance COGS |
| Name/SKU/category/photos | All item views everywhere | Qty, costs, finance |
| Location (via Edit) | Which warehouse/store lists it | Qty; often no transfer Activity Log |
| Group | Filters + group labels | Qty/finance |
| Delete item | Everywhere live stock + Activity Log + KPIs | May leave purchase history |
| Purchase price (on Purchases) | Cost / finance | Target price (unless edited separately) |
| POS sale | Qty + value on Individual Items | Target price itself |
| Transfer (formal) | Placement across modules | Random unrelated items |
