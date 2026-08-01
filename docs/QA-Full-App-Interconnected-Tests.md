# QA Script — Full Application Interconnected Tests

**App:** CargoTrader  
**Purpose:** Manually verify every major page, form, and feature — especially where one action must update other modules.  
**Companion (deep inventory-only script):** `docs/QA-Individual-Items-Interconnected-Tests.md`

| Tester | Date | Role(s) used | Environment (local / staging / prod) | Plan (Free / Pro / Plus / Enterprise) |
|--------|------|--------------|--------------------------------------|---------------------------------------|
|        |      |              |                                      |                                       |

---

## How to use this document

1. Use a **test business** you can safely create, edit, sell, and delete in.
2. Prefer simple numbers (qty **10**, prices **5,000** / **6,000**) so math is easy.
3. After each save, **refresh** related pages if they do not auto-update.
4. Mark **Pass / Fail**, fill before/after tables, and write short **Notes** on failures.
5. Run **Section 0 (Auth + roles)** first, then the **golden path** (Section 1), then module sections as needed.

### Formulas

```
Item inventory value     = Quantity × Target price
Value change (target)    = Quantity × (New target − Old target)
POS sale value drop      = Units sold × Target price
P&L (simplified)         ≈ Revenue − Expenses (for the selected period)
```

### Roles quick reference

| Role | Typical access |
|------|----------------|
| Business Owner / Manager | Full app (plan permitting) |
| Accountant | View purchases/shipping/stores/warehouses; full finance; no POS/manage ops |
| Warehouse Worker | Scoped warehouses + inventory; no purchases/shipping/finance/users |
| Store Clerk | Locked store: inventory, POS, transactions; lands on POS |

### Plan gates (expect upgrade / block when exceeded)

Purchases · Shipping · POS · Inventory item limit · Warehouse limit · Store limit · User limit · Shipments/year · AI fill quota

---

# SECTION 0 — Auth, invites, and access

---

## Test 0.1 — Register new business (email/password)

| Field | Value used |
|-------|------------|
| Name | |
| Email / phone | |
| Business name | |
| Country | |
| Currency | |

| Check | Expected | Pass? |
|-------|----------|-------|
| Account creates and lands in app | Dashboard (or role home) | ☐ |
| Empty inventory / new business | Yes | ☐ |
| Free plan / pricing visible as designed | Yes | ☐ |
| Can log out and log back in | Yes | ☐ |

**Notes:** _________________________________________________

**Result:** ☐ Pass ☐ Fail

---

## Test 0.2 — Register / continue with Google

| Check | Expected | Pass? |
|-------|----------|-------|
| Google signup on Create Account works | Creates/reactivates session | ☐ |
| Deactivated prior email can reactivate via Google signup | New/restored access; business created if none | ☐ |
| Google login on Login page works for active users | Session starts | ☐ |
| Deactivated user on **Login** (not signup) | Clear deactivated message | ☐ |

**Notes:** _________________________________________________

**Result:** ☐ Pass ☐ Fail

---

## Test 0.3 — Login / logout / remember me

| Check | Expected | Pass? |
|-------|----------|-------|
| Wrong password | Clear error; no session | ☐ |
| Correct login | Role home: Owner→Dashboard, Clerk→POS, WW→Inventory | ☐ |
| Remember me | Session persists as designed | ☐ |
| Logout | Cannot open protected routes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## Test 0.4 — Forgot / reset password

| Field | Value |
|-------|-------|
| Email | |
| Reset received? | ☐ Yes ☐ No ☐ Dev preview link |

| Check | Expected | Pass? |
|-------|----------|-------|
| Forgot password always shows safe success message | Yes | ☐ |
| Valid token → set new password → can login | Yes | ☐ |
| Invalid/expired token rejected | Yes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## Test 0.5 — Invite staff (Owner/Manager)

Invite at least: **Store Clerk**, **Warehouse Worker**, **Accountant**.

| Invitee | Role | Store / WH assignment | Pass? |
|---------|------|------------------------|-------|
| | Store Clerk | Store: ________ | ☐ |
| | Warehouse Worker | WH: ________ | ☐ |
| | Accountant | — | ☐ |

| Check | Expected | Pass? |
|-------|----------|-------|
| Invite link / accept form works (name + password) | Joins business | ☐ |
| Clerk without store sees assignment notice / limited access | Yes | ☐ |
| Clerk with store only sees their store data | Yes | ☐ |
| WW only sees assigned warehouse(s) | Yes | ☐ |
| Accountant: finance yes; POS manage no; purchases view-only | Yes | ☐ |
| User plan limit blocks extra invites when at cap | Upgrade/limit message | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## Test 0.6 — Edit / deactivate / remove staff

| Action | Expected | Pass? |
|--------|----------|-------|
| Edit staff: change role / store / WH / Account active | Saves; access updates after re-login/refresh | ☐ |
| Deactivate account | Cannot login; clear message | ☐ |
| Reactivate | Can login again | ☐ |
| Remove from business | Removed from Users list; if last business → deactivated | ☐ |
| Cannot remove business owner | Blocked | ☐ |
| Edit modal fully visible (header + Full name + Save) | Not clipped | ☐ |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 1 — Golden path (must-run interconnected chain)

Run this as one story with one product if possible.

| Field | Value |
|-------|-------|
| Item name | |
| SKU | |
| Category | |
| Warehouse | |
| Store | |
| Purchase price | |
| Target price | |
| Qty purchased | |

---

## GP1 — New Purchase (saved, not draft)

### Form fields to fill

| Field | Value | OK? |
|-------|-------|-----|
| Item name | | ☐ |
| SKU | | ☐ |
| Category | | ☐ |
| Group (optional) | | ☐ |
| Qty | | ☐ |
| Location (warehouse) | | ☐ |
| Purchase price | | ☐ |
| Target price | | ☐ |
| Supplier (existing or new) | | ☐ |
| Purchase date | | ☐ |
| Photos / notes (optional) | | ☐ |
| AI photo fill (if plan allows) | | ☐ |

### After Save — interconnected checks

| Module | Expected | Actual / notes | Pass? |
|--------|----------|----------------|-------|
| Purchasing → All Purchases | Purchase appears | | ☐ |
| Inventory → Individual Items | Item appears; qty & prices correct | | ☐ |
| Warehouse stock | Item in chosen WH | | ☐ |
| Activity Log | Inbound / purchase-style entry | | ☐ |
| Finance → Expenses | Auto cost / COGS impact as designed | | ☐ |
| Dashboard / Purchase Quick Stats | Counts/spend update | | ☐ |
| Draft instead of Save | Does **not** add live stock | | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## GP2 — Inventory target price edit (value only)

See also: `QA-Individual-Items-Interconnected-Tests.md` Test A1.

| Metric | Before | After | Expected |
|--------|--------|-------|----------|
| Qty | | | Unchanged |
| Target price | | | New target |
| Value = qty × target | | | Exact math |
| Purchase price | | | Unchanged |
| Finance expense total | | | Unchanged |
| POS / store / WH sell price | | | = new target |

**Result:** ☐ Pass ☐ Fail

---

## GP3 — Transfer warehouse → store

| Field | Value |
|-------|-------|
| From warehouse | |
| To store | |
| Qty transferred | |

| Check | Expected | Pass? |
|-------|----------|-------|
| WH stock qty down (or item gone if all moved) | Yes | ☐ |
| Store inventory shows item | Yes | ☐ |
| Individual Items location/placement updated | Yes | ☐ |
| Activity Log / WH-store logs as designed | Yes | ☐ |
| POS for that store can sell it | Yes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## GP4 — POS sale

| Field | Before | After | Expected |
|-------|--------|-------|----------|
| Qty on shelf | | | − units sold |
| Target price | | | Unchanged |
| Value | | | new qty × target |
| Units sold (N) | | | |
| Cart total / paid | | | |

| Check | Expected | Pass? |
|-------|----------|-------|
| Complete sale (Cash) succeeds | Yes | ☐ |
| Hold sale does **not** reduce stock | Yes | ☐ |
| Transactions list shows sale | Yes | ☐ |
| Finance → Revenue / Cash Flow / P&L update | Yes | ☐ |
| Activity Log outbound | Yes | ☐ |
| Stores Quick Stats / Dashboard update | Yes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## GP5 — Sale return (partial)

| Field | Value |
|-------|-------|
| Transaction | |
| Qty returned | |
| Refund method | |
| Reason | |

| Check | Expected | Pass? |
|-------|----------|-------|
| Store / Individual Items qty up by return qty | Yes | ☐ |
| Finance reflects refund / adjustment | Yes | ☐ |
| Activity Log inbound / return | Yes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

## GP6 — Transfer warehouse → shipment → mark arrived

| Field | Value |
|-------|-------|
| Shipment ID | |
| Qty to ship | |
| Offload / destination WH | |

| Check | Expected | Pass? |
|-------|----------|-------|
| After transfer to shipment: item “On Transit” / on shipment cargo | Yes | ☐ |
| Active Shipments detail shows cargo | Yes | ☐ |
| Mark Arrived / complete as designed | Moves toward completed | ☐ |
| Stock appears in destination warehouse | Yes | ☐ |
| Leaves transit listing appropriately | Yes | ☐ |
| Activity Log updated | Yes | ☐ |
| Upload a document on Documents page for this shipment | Linked & downloadable | ☐ |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 2 — Dashboard

| Check | Expected | Pass? |
|-------|----------|-------|
| KPIs load without error | Yes | ☐ |
| Inventory / warehouse / shipping / finance cards reflect recent GP data | Directionally correct | ☐ |
| Finance period toggle changes totals | Yes | ☐ |
| Plan status / usage visible | Yes | ☐ |
| Clerk / WW redirected away from dashboard | Yes | ☐ |
| Terms / Privacy / Contact footer links work | Yes | ☐ |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 3 — Inventory module

> Deep script: `docs/QA-Individual-Items-Interconnected-Tests.md`

## 3.1 Individual Items — local UI

| # | Feature | Pass? | Notes |
|---|---------|-------|-------|
| 1 | Search | ☐ | |
| 2 | Filters: category / location / group / ungrouped | ☐ | |
| 3 | Pagination + page size | ☐ | |
| 4 | Select / select all + bulk bar | ☐ | |
| 5 | View item detail | ☐ | |
| 6 | Scan QR + clear scan | ☐ | |
| 7 | View QR | ☐ | |
| 8 | Export All / Selected CSV | ☐ | |
| 9 | Print report / labels | ☐ | |
| 10 | Manage Groups: create / assign / delete (items → Ungrouped) | ☐ | |
| 11 | Edit: name/SKU/category/photos/notes sync elsewhere | ☐ | |
| 12 | Edit: location placement moves WH/store listing | ☐ | |
| 13 | Edit: qty & purchase price locked | ☐ | |
| 14 | Bulk delete → gone WH/store/POS + Activity Log | ☐ | |
| 15 | Accountant read-only; clerk no cost; WW scoped | ☐ | |

## 3.2 Activity Log

| Check | Pass? |
|-------|-------|
| Filters: All / Inbound / Outbound | ☐ |
| Location kind: All / Warehouse / Store | ☐ |
| Search + pagination | ☐ |
| Shows purchase, sale, delete, return, transfer-related lines as designed | ☐ |

## 3.3 Inventory Quick Stats

| Check | Pass? |
|-------|-------|
| KPIs: items, units, value, OOS match reality | ☐ |
| Categories / groups sections load | ☐ |
| CSV export works | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 4 — Purchasing module *(plan: purchases)*

## 4.1 New Purchase form (validation)

| Check | Expected | Pass? |
|-------|----------|-------|
| Required fields block empty submit | Yes | ☐ |
| Add supplier inline then select it | Works | ☐ |
| Save vs Draft behavior | Save stocks; Draft does not | ☐ |
| Edit via `?edit=` / bulk edit from All Purchases | Loads & updates | ☐ |
| AI photo fill (plan on) | Fills fields / respects quota | ☐ |
| AI photo fill (plan off / quota exceeded) | Clear upgrade/limit message | ☐ |
| PlanGate when purchases not on plan | Upgrade path | ☐ |

## 4.2 All Purchases

| Check | Pass? |
|-------|-------|
| Search / supplier filter | ☐ |
| View modal | ☐ |
| Export / print all & selected | ☐ |
| Pagination | ☐ |
| Bulk delete saved purchase reverses inventory/finance as designed | ☐ |
| Accountant cannot manage; can view | ☐ |

## 4.3 Suppliers

### Form fields (Add / Edit)

| Field | Tested? |
|-------|---------|
| Name * | ☐ |
| City / Country | ☐ |
| Email / Phone | ☐ |
| Rating | ☐ |

| Check | Pass? |
|-------|-------|
| Create / edit / view / delete | ☐ |
| Cannot delete supplier with linked purchases | ☐ |
| Export / print / bulk delete | ☐ |
| Pagination / search | ☐ |
| Appears in New Purchase supplier dropdown | ☐ |

## 4.4 Purchase Quick Stats

| Check | Pass? |
|-------|-------|
| Totals / spend / suppliers / categories sensible | ☐ |
| CSV export | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 5 — Warehouses

## 5.1 Warehouse list + form

### Add / Edit warehouse fields

| Field | Value tested | OK? |
|-------|--------------|-----|
| Name * | | ☐ |
| Address | | ☐ |
| Country | | ☐ |
| Capacity (m³) | | ☐ |
| Manager / phone | | ☐ |

| Check | Pass? |
|-------|-------|
| Search / export / select | ☐ |
| Plan warehouse limit blocks add | ☐ |
| Delete warehouse (when allowed) behavior | ☐ |
| WW sees only assigned warehouses | ☐ |
| Accountant view-only | ☐ |

## 5.2 Warehouse detail modal

| Check | Pass? |
|-------|-------|
| Modal fully visible; search / category usable | ☐ |
| Stock pagination | ☐ |
| Export / print icons work | ☐ |
| Add stock form creates item in WH + Individual Items | ☐ |
| Edit stock: identity/target update; qty/cost locked as designed | ☐ |
| Transfer selected → other WH / store / shipment | ☐ |
| Inbound/Outbound log tab shows movements | ☐ |

### Transfer form

| Field | Value | OK? |
|-------|-------|-----|
| Destination type | WH / Store / Shipment | ☐ |
| Destination | | ☐ |
| Qty (partial OK) | | ☐ |
| Notes | | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 6 — Shipping *(plan: shipping)*

## 6.1 Create / Edit shipment form

| Field | Value tested | OK? |
|-------|--------------|-----|
| Shipment ID | | ☐ |
| Origin city / country | | ☐ |
| Dest city / country | | ☐ |
| Status | | ☐ |
| Weight / method (ocean/air/traveler) | | ☐ |
| Carrier / container / tracking | | ☐ |
| ETA | | ☐ |
| Item count / bale count (if shown) | | ☐ |
| Goods / freight USD (costs) | | ☐ |
| Offload warehouse | | ☐ |

| Check | Pass? |
|-------|-------|
| Create appears on Active list | ☐ |
| Edit updates row/detail | ☐ |
| Shipment plan limit / yearly cap messaging | ☐ |
| Search / status / carrier filters / chips | ☐ |
| Export / print list | ☐ |
| Delete shipment (when allowed) | ☐ |
| Live tracking refresh (if enabled) | ☐ |
| Accountant view-only | ☐ |
| Clerk / WW cannot access shipping | ☐ |

## 6.2 Shipment detail modal

| Check | Pass? |
|-------|-------|
| Cargo list + search/category + pagination | ☐ |
| Transfer off shipment | ☐ |
| Export items / packing list | ☐ |
| Mark Arrived | ☐ |
| Modal not clipped; icons/search usable | ☐ |

## 6.3 Completed shipments

| Check | Pass? |
|-------|-------|
| Completed statuses listed | ☐ |
| Year chip / filters / export / view detail | ☐ |

## 6.4 Documents

### Upload / Edit document form

| Field | Tested? |
|-------|---------|
| Name / type | ☐ |
| Shipment | ☐ |
| File upload | ☐ |
| Status / notes | ☐ |

| Check | Pass? |
|-------|-------|
| Filters: status chip / type / shipment / search | ☐ |
| Pagination | ☐ |
| View / open / download | ☐ |
| Export CSV / ZIP / print selected | ☐ |
| Bulk delete (manage role) | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 7 — Stores & POS *(plan: pos)*

## 7.1 All Stores + form

| Field | Value tested | OK? |
|-------|--------------|-----|
| Name * | | ☐ |
| Address / city | | ☐ |
| Shelf target | | ☐ |
| Manager / phone | | ☐ |

| Check | Pass? |
|-------|-------|
| Add / edit / delete | ☐ |
| Store plan limit | ☐ |
| Search | ☐ |
| Clerk cannot manage all stores (nav/permissions) | ☐ |

## 7.2 Store inventory

| Check | Pass? |
|-------|-------|
| Stock list / search / category / pagination | ☐ |
| Export / print icon-only; search has room | ☐ |
| View item | ☐ |
| Transfer out (if permitted) | ☐ |
| Log tab | ☐ |

## 7.3 POS Terminal

| Check | Pass? |
|-------|-------|
| Product grid loads for store | ☐ |
| Search / SKU / QR add to cart | ☐ |
| Qty adjust in cart | ☐ |
| Discount % / amount + confirm | ☐ |
| Hold / resume / cancel | ☐ |
| Complete sale (Cash) | ☐ |
| Success modal | ☐ |
| Clerk locked to assigned store | ☐ |
| Accountant cannot open POS manage | ☐ |
| Empty cart cannot complete | ☐ |

## 7.4 Transactions

| Check | Pass? |
|-------|-------|
| List / search / pagination | ☐ |
| Detail view | ☐ |
| Process return (partial qty, method, reason) | ☐ |
| Export / print | ☐ |

## 7.5 Stores Quick Stats

| Check | Pass? |
|-------|-------|
| Sales / refunds / inventory figures sensible | ☐ |
| CSV export | ☐ |
| Hidden from clerk nav as designed | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 8 — Finance

Shared: period filter · currency · Record Revenue / Expense · auto-synced rows not editable/deletable.

## 8.1 Record Revenue form (manual)

| Field | Tested? |
|-------|---------|
| Amount / currency | ☐ |
| Date | ☐ |
| Category / source | ☐ |
| Notes | ☐ |

| Check | Pass? |
|-------|-------|
| Appears on Revenue + Cash Flow + Dashboard/P&L | ☐ |
| Can edit/delete **manual** only | ☐ |
| POS auto revenue not editable | ☐ |

## 8.2 Record Expense form (manual)

| Field | Tested? |
|-------|---------|
| Amount / date / category | ☐ |
| Notes | ☐ |
| Receipt upload(s) | ☐ |
| AI receipt fill (plan/quota) | ☐ |

| Check | Pass? |
|-------|-------|
| Appears on Expenses + Cash Flow + P&L | ☐ |
| Manual edit/delete OK; purchase auto rows locked | ☐ |
| Modal footer (Cancel/Save) fully visible | ☐ |

## 8.3 Pages

| Page | Checks | Pass? |
|------|--------|-------|
| `/finance` Dashboard | KPIs; Excel/PDF export | ☐ |
| Revenue | List; KPIs; export/print; pagination | ☐ |
| Expenses | Sort; export; bulk delete manual; pagination | ☐ |
| Cash Flow | Inflow/outflow; ledger; export | ☐ |
| Profit & Loss | Period statement; Send to Accountant (Excel/PDF/copy/email) | ☐ |

### Period consistency spot-check

| Metric (same period) | Revenue page | Expenses page | Cash Flow | P&L | Match? |
|----------------------|--------------|---------------|-----------|-----|--------|
| Total revenue | | | | | ☐ |
| Total expenses | | | | | ☐ |
| Net / cash impact | | | | | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 9 — Settings & Pricing

## 9.1 Profile

| Field | Tested? |
|-------|---------|
| Name | ☐ |
| Phone | ☐ |
| Preferred currency | ☐ |
| Email (read-only) | ☐ |
| Role (read-only) | ☐ |

| Check | Pass? |
|-------|-------|
| Save changes updates profile | ☐ |
| Currency change reflects in money displays | ☐ |
| Stripe billing portal (paid + permitted) | ☐ |

## 9.2 Users & Staff

Covered in Section 0.5–0.6. Also:

| Check | Pass? |
|-------|-------|
| Pending invites list | ☐ |
| View staff modal | ☐ |
| Delete invite | ☐ |

## 9.3 Pricing & Plans

| Check | Pass? |
|-------|-------|
| Free / Pro / Plus / Enterprise cards render | ☐ |
| Monthly / yearly toggle | ☐ |
| Checkout / upgrade (test mode OK) | ☐ |
| Downgrade confirm | ☐ |
| Feature comparison accurate vs gates | ☐ |
| PlanUpgradeBanner from gated routes | ☐ |
| After plan change: sidebar modules appear/disappear correctly | ☐ |

**Module result:** ☐ Pass ☐ Fail

---

# SECTION 10 — Public / legal pages

| Route | Check | Pass? |
|-------|-------|-------|
| `/terms` | Loads | ☐ |
| `/privacy` | Loads | ☐ |
| `/contact` | Form or support content works | ☐ |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 11 — Cross-role denial matrix (spot checks)

For each cell: attempt action → expect **allowed** or **blocked**.

| Action | Owner/Mgr | Accountant | Warehouse Worker | Store Clerk |
|--------|-----------|------------|------------------|-------------|
| Open POS & complete sale | ☐ | ☐ deny manage | ☐ deny | ☐ (own store) |
| New Purchase | ☐ | ☐ deny | ☐ deny | ☐ deny |
| Transfer WH stock | ☐ | ☐ deny manage | ☐ (scoped) | ☐ deny |
| Open Shipping | ☐ | ☐ view | ☐ deny | ☐ deny |
| Open Finance | ☐ | ☐ | ☐ deny | ☐ deny |
| Invite users | ☐ | ☐ deny | ☐ deny | ☐ deny |
| See purchase cost on inventory | ☐ | ☐ view | ☐ as designed | ☐ no cost |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 12 — Limits & negative tests

| Scenario | Expected | Pass? |
|----------|----------|-------|
| At warehouse limit → Add Warehouse | Block + upgrade message | ☐ |
| At store limit → Add Store | Block + upgrade message | ☐ |
| At user limit → Invite | Block + upgrade message | ☐ |
| At inventory item limit → purchase/add stock | Block as designed | ☐ |
| At shipment yearly limit → New Shipment | Block as designed | ☐ |
| AI fill over quota | Clear message | ☐ |
| Delete supplier with purchases | Blocked | ☐ |
| Complete POS with empty cart | Blocked | ☐ |
| Transfer qty > available | Blocked / validation | ☐ |
| Open protected URL while logged out | Redirect login | ☐ |

**Result:** ☐ Pass ☐ Fail

---

# SECTION 13 — Quick reference: what should update what

| If you… | Should update… | Usually should NOT… |
|---------|----------------|---------------------|
| Save a purchase | Items, WH stock, activity, finance COGS/expenses, purchase stats | POS until transferred to store |
| Save a draft purchase | Purchase list as draft only | Live stock / finance stock impact |
| Edit inventory **target** price | Value KPIs, WH/store/POS sell price | Finance COGS |
| Edit purchase **cost** (Purchases) | Cost / finance | Target unless edited separately |
| Transfer WH ↔ Store ↔ Shipment | Placement/qty everywhere + logs | Unrelated items |
| Mark shipment arrived | Dest WH stock; leave active→completed path | Random finance unless costs designed to post |
| POS sale | Store qty, transactions, revenue/cash/P&L, activity | Purchase records |
| Return sale | Qty up; finance refund; activity | Target price |
| Delete inventory item | Gone everywhere live; activity; KPIs | May leave purchase history |
| Invite/edit staff | Route access + data scope | Other businesses’ data |
| Change plan | Feature gates + limits | Existing data wiped |
| Change profile currency | Display of money | Underlying stored amounts (as designed) |
| Deactivate user | Login blocked | Delete historical transactions |

---

# SECTION 14 — Final sign-off

| Area | Overall | Comments |
|------|---------|----------|
| 0 Auth / invites / staff | ☐ Pass ☐ Fail | |
| 1 Golden path (Purchase→…→Finance/Shipping) | ☐ Pass ☐ Fail | |
| 2 Dashboard | ☐ Pass ☐ Fail | |
| 3 Inventory | ☐ Pass ☐ Fail | |
| 4 Purchasing | ☐ Pass ☐ Fail | |
| 5 Warehouses | ☐ Pass ☐ Fail | |
| 6 Shipping | ☐ Pass ☐ Fail | |
| 7 Stores / POS | ☐ Pass ☐ Fail | |
| 8 Finance | ☐ Pass ☐ Fail | |
| 9 Settings / Pricing | ☐ Pass ☐ Fail | |
| 10 Legal | ☐ Pass ☐ Fail | |
| 11 Role denials | ☐ Pass ☐ Fail | |
| 12 Limits / negatives | ☐ Pass ☐ Fail | |
| **Release recommendation** | ☐ Ready ☐ Not ready | |

**Blockers**

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

**Tester:** ______________________ **Date:** ______________

---

## Suggested minimum run (if time-boxed)

1. Section 0.1 + 0.5 (Owner + Clerk invite)  
2. Full Section 1 golden path  
3. Section 8 period consistency  
4. Section 11 spot checks for Clerk + Accountant  
5. Section 12 one limit test  

For inventory-only deep coverage, use `QA-Individual-Items-Interconnected-Tests.md`.
