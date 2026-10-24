# Multipart development plan — market-informed gaps vs Billing workspace (BS)

### Reference-only policy (mandatory)

- **`Vyapar_ScreenShots.pdf`**, **`Vyapar_ScreenShots.docx`**, and any similar material are **inspiration only** — a rough catalogue of problems SMB billing apps often solve.
- **Do not** reproduce Vyapar (or any third party) **screens, layouts, flows, wording, branding, iconography, or feature naming** — avoid “parity cloning.”
- **Do** use those references to ask: *what job is the user trying to do?* Then design **BS-native** flows, APIs, and UI that fit your locked requirements (`REQUIREMENTS_V1_LOCK.md`) and product principles.
- Where this doc lists capabilities (quotes, purchases, receipts, etc.), treat them as **candidate backlog themes**, not a mandate to match another product screen-for-screen.

**Source material (pick what your team prefers):**

| Path | Notes |
|------|--------|
| `D:/Vyapar_ScreenShots.docx` (~53 MB) | Often easier to **scroll in Word** than a long PDF. This copy embeds **many screenshot images** (`word/media/*.png` — hundreds of assets). The document body has **almost no typed captions**, so **automated text extraction does not recover UI labels** — same limitation class as the PDF unless you **add headings/captions** under each image in Word. |
| `D:/Vyapar_ScreenShots.pdf` (~38 MB, ~154 pages) | Raster pages; **no text layer** for tooling here. |

For either format: the checklist below stays **generic market vocabulary** cross-checked with **this repo**, until someone adds **structured notes or OCR** — still **reference-only**, never a spec to clone.

**Tip:** If you paste **short BS-neutral captions** under groups of screenshots in the `.docx` (e.g. “payment allocation”, “stock adjustment”), future gap reviews become searchable without OCR.

**BS design:** Ship everything in **your** system look — dark shell (`#070a12`), `workspace-panel`, blue/indigo accents, existing typography and components — so the product stays visually and experientially **your own**.

---

## Part 1 — What BS already implements (baseline)

Aligned with live API controllers under `BillingApp.Api/Controllers/V1/` and web routes in `web/src/app/App.tsx`.

| Area | Implemented |
|------|-------------|
| Identity & workplace | JWT auth, refresh, tenant + org context, profile, org memberships, org CRUD (permissions gated) |
| Authorization | RBAC permissions, role grants, delegations surface (API) |
| Sales invoicing | Posted invoices: list, detail, create lines with products; INR rounding per app rules |
| Customers | Directory CRUD for invoice buyers |
| Parties | Counterparty master (kinds: customer/vendor/other) |
| Products | Catalog with categories, brands, units, pricing, stock fields, images |
| Dashboard | Summary metrics API |
| Invoice UX | Detail view, **print + PDF** export with org branding (web) |

**Explicit non-goals in current codebase:** purchase lifecycle, payment vouchers, expense vouchers, full double-entry ledger UI, GST return generators, quotations as first-class documents, multi-warehouse stock transfers, POS/thermal flows, barcode generation, offline-first mobile POS.

---

## Part 2 — Market-informed capability checklist (optional stimulus)

Skim external screenshots **only** to jog ideas about real-world jobs-to-be-done; tick what **your** stakeholders want in BS — not what another app shows verbatim.

### A. Sales beyond posted invoice

- [ ] **Quotations / estimates / proforma** — draft doc → convert to invoice  
- [ ] **Sales orders** — fulfillment pipeline vs immediate invoice  
- [ ] **Delivery challan** — dispatch without bill or before bill  
- [ ] **Credit notes / sales returns** — negative sales linked to original invoice  
- [ ] **Receipts (“payment in”)** — allocate to invoices / advance  
- [ ] **Cash sales / quick sale** — fast lane UI using **BS** patterns only

### B. Purchase side

- [ ] **Purchase bills** — supplier GRN + inward stock + payable  
- [ ] **Purchase orders** — optional preorder workflow  
- [ ] **Debit notes / purchase returns**  
- [ ] **Payments out** — settle supplier dues  

### C. Cash, bank, expenses

- [ ] **Cash & bank accounts** — balances, transfers  
- [ ] **Expense entries** — categories, attachments (later)  
- [ ] **Cheque / UPI / NEFT reference fields** on settlements  

### D. Inventory depth

- [ ] **Stock ledger** — per item movement history (sale, purchase, adjustment)  
- [ ] **Stock adjustment** — shrinkage, opening, correction with reason  
- [ ] **Multiple locations / godowns** — optional multi-bin  
- [ ] **Low stock workflows** — alerts beyond current dashboard-style counts  
- [ ] **Batch / serial** — if your domain needs expiry/batch tracking (common in inventory-heavy domains)

### E. Party & ledger accounting

- [ ] **Party ledger statement** — running balance, aging buckets  
- [ ] **Outstanding reports** — receivables / payables  

### F. Tax & compliance (India)

- [ ] **GSTIN on org / party** — you have partial party tax fields; org GSTIN may need schema  
- [ ] **HSN/SAC on lines** — invoice line metadata  
- [ ] **Tax breakdown** — CGST/SGST/IGST split on invoice  
- [ ] **GSTR-oriented extracts** — B2B/B2C summaries (export only; filing optional)

### G. Reporting & analytics

- [ ] **Day book / cash book**  
- [ ] **Sales & purchase registers**  
- [ ] **Profit & loss snapshot** — revenue − COGS − expenses (needs cost semantics)  
- [ ] **Stock valuation** — FIFO/average policy decision  

### H. Operations & convenience

- [ ] **Barcode / label printing** — generation + template (web or service)  
- [ ] **Thermal printer path** — optional; BS can stay browser/PDF-first initially  
- [ ] **Reminders** — payment due nudges (email/WhatsApp integration later)  
- [ ] **Multi-user activity / audit** — financial edit audit trail per locked requirements  

---

## Part 3 — Gap summary (features not implemented today)

Grouped for planning (maps to Part 2 unchecked items vs repo reality).

1. **Commercial documents:** quotations, orders, challans, credit/debit notes.  
2. **Buy-side:** purchase bills, POs, supplier payments.  
3. **Treasury:** cash/bank accounts, transfers, expense booking, payment allocation.  
4. **Inventory movements:** immutable movement log, adjustments, optional multi-location/batch.  
5. **Ledgering:** party statements, aging, outstanding.  
6. **Tax depth:** line-level HSN, GST breakdown, export registers.  
7. **Reporting:** registers, day book, P&amp;L-oriented views once costs exist.  
8. **Field ops:** barcode/labels, reminders — typically last mile.

---

## Part 4 — Multipart development plan (recommended phases)

Each phase ends with **shippable vertical slices**: migrations + repositories + `/api/v1` endpoints + React pages consistent with existing patterns (`authApi`, React Query, `workspace-panel`, sidebar sections).

### Part 4.A — Phase 1: Money in (without full accounting engine)

**Objective:** Close a common gap after invoicing — **recording money received**.

- Data: `PaymentReceipt` (org-scoped), links to `Invoice` (many-to-one or allocations table).  
- API: list/create receipts; optional partial pay; update invoice **paid balance / status** rules (align with CORE rounding).  
- UI: “Receipts” under Billing; invoice detail shows payment history (BS-styled timeline cards).  
- Permissions: e.g. `payments.create`, `payments.read`.

**Depends on:** Current invoice model only.

---

### Part 4.B — Phase 2: Purchase bills + payments out

**Objective:** Symmetric **buy** flow.

- Data: `PurchaseBill`, `PurchaseLine`, link to `Party` (vendor), stock increment hooks.  
- API: CRUD/list/detail; posting affects product `StockQty`.  
- UI: “Purchases” section; vendor picker from Parties (`Vendor`).  
- Permissions: `purchases.*`.

**Depends on:** Phase 1 patterns for settlement optional extension.

---

### Part 4.C — Phase 3: Stock ledger + adjustments

**Objective:** Auditable inventory — **movement history** users can trust.

- Data: `StockMovement` (product, qty delta, reason enum, ref type/id).  
- Trigger writes from posted invoice lines (sale), purchase lines (buy), manual adjustment.  
- UI: product detail drill-down “Movements”; adjustment wizard with reason codes.  
- Permissions: `inventory.adjust`.

**Depends on:** Phase 2 if inward from purchases is primary; can start with adjustments + sales-only movements.

---

### Part 4.D — Phase 4: Quotes → invoice conversion

**Objective:** Sales pipeline with **BS-designed** screens and steps (reference apps may suggest the idea of quotes — not the UX).

- Data: `SalesQuote` + lines; status `Draft/Sent/Accepted/Expired`; conversion copies lines to new invoice draft or posted per policy.  
- UI: Quotes list + editor reusing invoice line components (shared molecule).  
- Permissions: `quotes.*`.

**Depends on:** Stable invoice line schema.

---

### Part 4.E — Phase 5: Party ledger & outstanding

**Objective:** Trust-building reports for SMB users.

- Read models: running balance per party from invoices + receipts + purchases + payments out.  
- UI: Party detail tab “Statement”; org-level “Receivables” table.  
- Export: CSV / previews using **BS-native** tables and typography.

**Depends on:** Phases 1–2 minimum.

---

### Part 4.F — Phase 6: GST depth & registers

**Objective:** Compliance-oriented extracts without locking filing vendor.

- Schema: org GSTIN; invoice line `HsnSac`, tax rates; snapshot totals per document.  
- API: summary endpoints for period B2B/B2C; JSON + CSV.  
- UI: “Tax center” page under Billing or Reports.

**Depends on:** Stable sales/purchase documents.

---

### Part 4.G — Phase 7 (optional): Barcodes, reminders, multi-godown

**Objective:** Operational polish once core money & stock paths exist.

- Barcode: generate codes per SKU; print PDF labels using BS invoice PDF patterns.  
- Reminders: scheduled jobs + templates — infra-heavy; defer.  
- Multi-godown: `Location` + movement split — only if **your** stakeholders require it.

---

## Part 5 — UI / UX principles (BS-first; references stay invisible)

1. **Navigation:** Extend sidebar / command palette patterns you already use — invent information architecture that fits BS users, not another product’s menu tree.  
2. **Density:** Pick breakpoints and density for **your** audience; external apps may be phone-heavy — adapt without imitating their chrome.  
3. **Language:** Product copy and labels are **original**; regulatory terms (e.g. GSTIN, HSN) only where the domain requires them.  
4. **Visual system:** Stay inside one coherent BS theme — no borrowed palettes or layout clones from screenshot packs.  
5. **Print/PDF:** New document types get **new BS-styled** templates (same quality bar as your invoice sheet), not replicas of third-party printouts.

---

## Part 6 — How to use external screenshots (if at all)

1. Treat PDFs as **optional** prompts — never as a spec to mirror.  
2. When something sparks an idea, capture it as a **BS requirement** (user story + acceptance criteria), not “same as slide X.”  
3. Prioritize by **your** business goals and locked CORE scope — not by screenshot page count.  
4. Promote scope changes only through **Requirements v2** / stakeholder sign-off when CORE calculations or locked behaviour are affected.

---

## Part 7 — Suggested immediate next step (engineering)

If choosing one slice after invoices: implement **Phase 1 — Payment receipts + invoice balance** — a practical increment toward fuller cash tracking **for BS users**, independent of any reference material.

---

*Third-party marks and screenshots are not endorsed or reproduced here. Reference PDFs are optional stimulus only; this document is an internal roadmap aid.*
