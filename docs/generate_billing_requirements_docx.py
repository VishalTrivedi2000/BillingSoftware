"""
Generate Billing Software Requirements Specification (.docx) with embedded DFD figures.
Run from repo root: python docs/generate_billing_requirements_docx.py
"""
from __future__ import annotations

import os
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)


def _save(fig, name: str) -> Path:
    path = ASSETS / name
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def draw_context_dfd() -> Path:
    """Level 0 (context) DFD — system boundary vs external entities."""
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title("Figure 1 — Context Diagram (Level 0 DFD)", fontsize=14, fontweight="bold", pad=16)

    # Central process
    core = FancyBboxPatch(
        (4.0, 2.7), 3.0, 1.6, boxstyle="round,pad=0.05", linewidth=2,
        edgecolor="#1a5276", facecolor="#d6eaf8",
    )
    ax.add_patch(core)
    ax.text(5.5, 3.85, "Billing &\nBusiness Suite", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(5.5, 3.15, "(Processes 1.0–7.0)", ha="center", va="center", fontsize=9, style="italic")

    entities = [
        (0.4, 5.2, "Customer /\nBuyer"),
        (0.4, 1.0, "Vendor /\nSupplier"),
        (8.8, 5.2, "Tax /\nStatutory\nAuthority"),
        (8.8, 1.0, "Bank /\nPayment\nGateways"),
        (5.2, 6.35, "Business Users\n(Owner, Staff,\nAccountant)"),
    ]
    for x, y, label in entities:
        r = FancyBboxPatch(
            (x, y), 1.6, 0.95, boxstyle="round,pad=0.03", linewidth=1.5,
            edgecolor="#145a32", facecolor="#eafaf1",
        )
        ax.add_patch(r)
        ax.text(x + 0.8, y + 0.48, label, ha="center", va="center", fontsize=9)

    arrows = [
        ((2.0, 5.65), (4.0, 3.8), "Orders,\npayments"),
        ((4.0, 3.4), (2.0, 1.45), "POs,\nGRN info"),
        ((7.0, 3.8), (8.8, 5.65), "Returns /\nfilings"),
        ((7.0, 3.2), (8.8, 1.45), "Remittances /\nstatements"),
        ((5.5, 6.28), (5.5, 4.32), "Configure /\noperate"),
    ]
    for (x1, y1), (x2, y2), lbl in arrows:
        ax.annotate(
            "", xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(arrowstyle="->", lw=1.5, color="#424949"),
        )
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx + 0.15, my, lbl, fontsize=7, color="#515a5a")

    ax.text(
        5.5, 0.35,
        "Flows are illustrative; naming follows your integration scope (e-invoice, TDS, payroll, etc.).",
        ha="center", fontsize=8, style="italic", color="#566573",
    )
    return _save(fig, "dfd_context_level0.png")


def draw_level1_dfd() -> Path:
    """Level 1 DFD — major processes and data stores."""
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis("off")
    ax.set_title("Figure 2 — Level 1 DFD (Major Processes & Data Stores)", fontsize=14, fontweight="bold", pad=12)

    processes = [
        (0.5, 6.4, "1.0\nMasters &\nParties"),
        (3.3, 6.4, "2.0\nSales /\nBilling"),
        (6.1, 6.4, "3.0\nPurchases"),
        (8.9, 6.4, "4.0\nInventory"),
        (0.5, 4.5, "5.0\nPayments /\nBanking"),
        (3.3, 4.5, "6.0\nTax /\nCompliance"),
        (6.1, 4.5, "7.0\nReports /\nAnalytics"),
        (8.9, 4.5, "8.0\nSecurity /\nAdmin"),
    ]
    for x, y, txt in processes:
        p = FancyBboxPatch(
            (x, y), 1.55, 1.05, boxstyle="round,pad=0.04", linewidth=1.5,
            edgecolor="#154360", facecolor="#aed6f1",
        )
        ax.add_patch(p)
        ax.text(x + 0.78, y + 0.52, txt, ha="center", va="center", fontsize=8.5, fontweight="bold")

    stores = [
        (2.2, 2.3, "D1\nMaster Data"),
        (5.0, 2.3, "D2\nTransactions"),
        (7.8, 2.3, "D3\nStock Ledger"),
        (10.2, 2.3, "D4\nGL /\nLedgers"),
    ]
    for x, y, txt in stores:
        s = mpatches.Rectangle((x, y), 1.35, 0.85, linewidth=1.5, edgecolor="#7d6608", facecolor="#fcf3cf")
        ax.add_patch(s)
        ax.text(x + 0.67, y + 0.42, txt, ha="center", va="center", fontsize=8, fontweight="bold")

    flows = [
        ((1.28, 6.4), (2.2, 3.15)),
        ((4.08, 6.4), (2.8, 3.15)),
        ((4.08, 6.4), (5.35, 3.15)),
        ((6.86, 6.4), (5.35, 3.15)),
        ((6.86, 6.4), (8.45, 3.15)),
        ((9.65, 6.4), (8.45, 3.15)),
        ((9.65, 6.4), (10.78, 3.15)),
        ((1.28, 4.5), (2.5, 3.15)),
        ((4.08, 4.5), (5.35, 3.15)),
        ((6.86, 4.5), (10.78, 3.15)),
        ((9.65, 4.5), (10.78, 3.15)),
    ]
    for (x1, y1), (x2, y2) in flows:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1 + 0.2),
                    arrowprops=dict(arrowstyle="->", lw=1.0, color="#5d6d7e", connectionstyle="arc3,rad=0.1"))

    ax.text(
        6.0, 1.0,
        "Double-headed flows omitted for clarity; each process reads/writes relevant stores per normalization rules.",
        ha="center", fontsize=8, style="italic", color="#566573",
    )
    return _save(fig, "dfd_level1_processes.png")


def draw_billing_lifecycle() -> Path:
    """Conceptual flow: quotation → fulfilment → compliance."""
    fig, ax = plt.subplots(figsize=(11, 4.2))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 4)
    ax.axis("off")
    ax.set_title(
        "Figure 3 — Typical Billing & Order Lifecycle (Conceptual)",
        fontsize=14, fontweight="bold", pad=10,
    )

    steps = [
        (0.4, 1.5, "Quote /\nEstimate"),
        (2.15, 1.5, "Sales\nOrder"),
        (3.9, 1.5, "Delivery\nChallan"),
        (5.65, 1.5, "Tax\nInvoice"),
        (7.4, 1.5, "Payment /\nReceipt"),
        (9.15, 1.5, "Returns /\nCredit Note"),
    ]
    for x, y, txt in steps:
        bx = FancyBboxPatch(
            (x, y), 1.35, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
            edgecolor="#6c3483", facecolor="#e8daef",
        )
        ax.add_patch(bx)
        ax.text(x + 0.67, y + 0.52, txt, ha="center", va="center", fontsize=9, fontweight="bold")

    for i in range(len(steps) - 1):
        x1 = steps[i][0] + 1.35
        x2 = steps[i + 1][0]
        y_mid = 2.05
        ax.annotate("", xy=(x2 - 0.05, y_mid), xytext=(x1 + 0.05, y_mid),
                    arrowprops=dict(arrowstyle="->", lw=2, color="#512e5f"))

    ax.text(
        5.5, 0.55,
        "Branches: POS skip SO; services may skip DC; e-invoice IRN generation hooks after invoice.",
        ha="center", fontsize=8.5, style="italic", color="#566573",
    )
    return _save(fig, "billing_lifecycle.png")


def draw_module_overview() -> Path:
    """Visual map of capability domains (superset)."""
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title(
        "Figure 4 — Capability Domains (Market Superset View)",
        fontsize=14, fontweight="bold", pad=14,
    )

    domains = [
        (0.35, 5.4, "Invoicing &\nDocuments"),
        (2.85, 5.4, "GST /\nE-Invoice /\nE-Way"),
        (5.35, 5.4, "Inventory /\nBatch /\nExpiry"),
        (7.85, 5.4, "POS /\nRetail"),
        (0.35, 3.5, "Purchasing /\nExpenses"),
        (2.85, 3.5, "Payments /\nBank /\nRecon"),
        (5.35, 3.5, "AR/AP /\nDunning"),
        (7.85, 3.5, "Projects /\nTime /\nMilestones"),
        (0.35, 1.6, "Payroll /\nHRMS\n(optional)"),
        (2.85, 1.6, "CRM /\nLeads\n(optional)"),
        (5.35, 1.6, "Reports /\nBI /\nDashboards"),
        (7.85, 1.6, "Security /\nRBAC /\nAudit"),
    ]
    colors = ["#d5f5e3", "#fdebd0", "#ebdef0", "#d6eaf8"] * 3
    for i, (x, y, txt) in enumerate(domains):
        bx = FancyBboxPatch(
            (x, y), 1.95, 1.15, boxstyle="round,pad=0.06", linewidth=1.3,
            edgecolor="#1e8449", facecolor=colors[i],
        )
        ax.add_patch(bx)
        ax.text(x + 0.97, y + 0.58, txt, ha="center", va="center", fontsize=9, fontweight="bold")

    ax.text(
        5.5, 0.45,
        "Inspired by suites such as Zoho (Books/CRM/Inventory ecosystem), Vyapar (GST retail/SME), "
        "and Indian SMB billing tools (e.g. MyBillBook-style GST billing & reminders).",
        ha="center", fontsize=8.5, wrap=True, color="#34495e",
    )
    return _save(fig, "capability_domains.png")


def draw_catalog_taxonomy() -> Path:
    """Marketplace-style: category tree, product type, listing vs SKU variants."""
    fig, ax = plt.subplots(figsize=(11, 7.2))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7.2)
    ax.axis("off")
    ax.set_title(
        "Figure 5 — Product Catalog Model (Flipkart / Amazon–style taxonomy)",
        fontsize=14,
        fontweight="bold",
        pad=14,
    )

    # Row 1: Category tree
    ax.text(5.5, 6.65, "Browse taxonomy (multi-level category tree)", ha="center", fontsize=10, fontweight="bold")
    cats = [
        (0.8, 5.85, "Dept\n(e.g. Electronics)"),
        (3.1, 5.85, "Category\n(Mobiles)"),
        (5.4, 5.85, "Sub-cat\n(Smartphones)"),
        (7.7, 5.85, "Leaf /\nBrowse node"),
    ]
    for x, y, t in cats:
        bx = FancyBboxPatch(
            (x, y), 1.75, 0.72, boxstyle="round,pad=0.04", linewidth=1.4,
            edgecolor="#b7950b", facecolor="#fdebd0",
        )
        ax.add_patch(bx)
        ax.text(x + 0.88, y + 0.36, t, ha="center", va="center", fontsize=8.5, fontweight="bold")
    for i in range(len(cats) - 1):
        x1 = cats[i][0] + 1.75
        x2 = cats[i + 1][0]
        ax.annotate(
            "", xy=(x2 - 0.02, 6.21), xytext=(x1 + 0.02, 6.21),
            arrowprops=dict(arrowstyle="->", lw=1.5, color="#9c640c"),
        )

    # Attribute schema (facet / specs) attached to category or product type
    sch = FancyBboxPatch(
        (0.55, 4.35), 4.1, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#1f618d", facecolor="#d6eaf8",
    )
    ax.add_patch(sch)
    ax.text(
        2.6, 5.15, "Attribute schema (inherits down the tree)", ha="center", fontsize=10, fontweight="bold",
    )
    ax.text(
        2.6, 4.65,
        "Faceted specs: RAM, Storage, Color, Screen Size, Wattage, Volume…\n"
        "Compliance defaults: HSN/SAC, expiry tracking flag, serial/IMEI policy",
        ha="center", va="center", fontsize=8.3, color="#1b2631",
    )

    # Product type template
    pt = FancyBboxPatch(
        (5.55, 4.35), 4.85, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#117864", facecolor="#d5f5e3",
    )
    ax.add_patch(pt)
    ax.text(8.0, 5.15, "Product type / template", ha="center", fontsize=10, fontweight="bold")
    ax.text(
        8.0,
        4.62,
        "Physical • Digital • Service • Bundle/KIT • Serialized • Weight-based\n"
        "Defines: stock policy, UOM, warranty, return window, BOM behaviour",
        ha="center",
        va="center",
        fontsize=8.3,
        color="#1b2631",
    )

    # Listing / SPU (customer-facing)
    spu = FancyBboxPatch(
        (1.2, 2.55), 3.4, 1.15, boxstyle="round,pad=0.05", linewidth=2,
        edgecolor="#6c3483", facecolor="#f5eef8",
    )
    ax.add_patch(spu)
    ax.text(2.9, 3.48, "Listing / Product (SPU)", ha="center", fontsize=11, fontweight="bold")
    ax.text(
        2.9,
        2.92,
        "One merchandising identity: title, brand, images,\n"
        "rich description, SEO slug, primary category",
        ha="center",
        va="center",
        fontsize=8.5,
    )

    # SKU variants (inventory)
    sku_box = FancyBboxPatch(
        (5.95, 2.55), 3.85, 1.15, boxstyle="round,pad=0.05", linewidth=2,
        edgecolor="#922b21", facecolor="#fadbd8",
    )
    ax.add_patch(sku_box)
    ax.text(7.88, 3.48, "Variants → SKU (stock unit)", ha="center", fontsize=11, fontweight="bold")
    ax.text(
        7.88,
        2.92,
        "Each combo of variant axes (Color × Storage × …)\n"
        "→ unique SKU: barcode, MRP, cost, batch/expiry rules",
        ha="center",
        va="center",
        fontsize=8.5,
    )

    ax.annotate(
        "", xy=(7.88, 3.7), xytext=(4.6, 3.15),
        arrowprops=dict(arrowstyle="->", lw=2, color="#78281f"),
    )
    ax.text(6.15, 3.85, "1 : N", fontsize=10, fontweight="bold", color="#78281f")

    # How billing uses it
    bill = FancyBboxPatch(
        (2.0, 0.85), 7.0, 0.95, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#283747", facecolor="#eaecee",
    )
    ax.add_patch(bill)
    ax.text(
        5.5,
        1.62,
        "Invoices / POS lines always resolve to a SKU (or service line); "
        "bundles explode to component SKUs per policy.",
        ha="center",
        va="center",
        fontsize=9,
        fontweight="bold",
    )
    ax.text(
        5.5,
        1.18,
        "Search & filters use category + attribute facets; reports roll up by category tree and brand.",
        ha="center",
        va="center",
        fontsize=8,
        style="italic",
        color="#566573",
    )

    # Vertical connectors from schema row to listing
    ax.annotate(
        "", xy=(2.9, 3.7), xytext=(2.6, 5.35),
        arrowprops=dict(arrowstyle="->", lw=1.2, color="#5d6d7e", linestyle="--"),
    )
    ax.annotate(
        "", xy=(7.88, 3.7), xytext=(8.0, 5.35),
        arrowprops=dict(arrowstyle="->", lw=1.2, color="#5d6d7e", linestyle="--"),
    )

    return _save(fig, "catalog_taxonomy_marketplace.png")


def draw_auth_architecture() -> Path:
    """Conceptual IAM: login, JWT/refresh, RBAC+ABAC PDP."""
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title(
        "Figure 6 — Identity & Access (JWT, RBAC + ABAC, delegation)",
        fontsize=14,
        fontweight="bold",
        pad=14,
    )

    clients = FancyBboxPatch(
        (0.35, 5.35), 2.35, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#1e8449", facecolor="#d5f5e3",
    )
    ax.add_patch(clients)
    ax.text(1.52, 6.25, "Clients", ha="center", fontsize=10, fontweight="bold")
    ax.text(1.52, 5.72, "Web • Mobile • POS • Integrations", ha="center", fontsize=8)

    gw = FancyBboxPatch(
        (3.55, 5.35), 2.15, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#2874a6", facecolor="#d6eaf8",
    )
    ax.add_patch(gw)
    ax.text(4.62, 6.05, "API Gateway\n(rate limit, TLS, request ID)", ha="center", fontsize=9, fontweight="bold")

    auth = FancyBboxPatch(
        (6.35, 5.35), 2.55, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#884ea0", facecolor="#ebdef0",
    )
    ax.add_patch(auth)
    ax.text(7.62, 6.25, "Auth service", ha="center", fontsize=10, fontweight="bold")
    ax.text(7.62, 5.72, "Login • MFA • Token issue/revoke", ha="center", fontsize=8)

    rs = FancyBboxPatch(
        (9.35, 5.35), 1.45, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#839192", facecolor="#eaecee",
    )
    ax.add_patch(rs)
    ax.text(10.08, 6.05, "Identity\nstore", ha="center", fontsize=9, fontweight="bold")

    for x1, x2 in [(2.7, 3.55), (5.7, 6.35), (8.9, 9.35)]:
        ax.annotate(
            "", xy=(x2, 5.88), xytext=(x1, 5.88),
            arrowprops=dict(arrowstyle="->", lw=1.5, color="#424949"),
        )

    ax.text(7.62, 4.85, "Access JWT (short TTL) + Refresh token (rotation, reuse detection)", ha="center", fontsize=9, fontweight="bold")

    pdp = FancyBboxPatch(
        (1.8, 2.55), 7.4, 1.35, boxstyle="round,pad=0.06", linewidth=2,
        edgecolor="#922b21", facecolor="#fadbd8",
    )
    ax.add_patch(pdp)
    ax.text(5.5, 3.62, "Authorization (PDP) — RBAC + ABAC", ha="center", fontsize=11, fontweight="bold")
    ax.text(
        5.5,
        3.05,
        "RBAC: roles → permissions (resource:action); scoped per tenant/org/branch.\n"
        "ABAC: policies on attributes (amount, branch, doc state, IP, time); deny-overrides-allow order.\n"
        "Delegation grants temporarily narrow/expansion of rights with expiry + audit.",
        ha="center",
        va="center",
        fontsize=8.5,
        color="#1b2631",
    )

    ax.annotate(
        "", xy=(5.5, 3.9), xytext=(5.5, 5.35),
        arrowprops=dict(arrowstyle="->", lw=1.8, color="#78281f"),
    )

    stores = FancyBboxPatch(
        (1.2, 0.55), 8.6, 1.05, boxstyle="round,pad=0.05", linewidth=1.5,
        edgecolor="#b7950b", facecolor="#fdebd0",
    )
    ax.add_patch(stores)
    ax.text(
        5.5,
        1.42,
        "Stores: users, roles, permissions, role bindings, ABAC policies, delegations, refresh-token families, API clients (M2M)",
        ha="center",
        fontsize=9,
        fontweight="bold",
    )
    ax.text(
        5.5,
        0.85,
        "Audit: auth events, policy decisions, admin changes to IAM; immutable retention policy.",
        ha="center",
        fontsize=8,
        style="italic",
        color="#566573",
    )

    ax.annotate(
        "", xy=(5.5, 2.55), xytext=(5.5, 1.6),
        arrowprops=dict(arrowstyle="->", lw=1.2, color="#9c640c", linestyle="--"),
    )

    return _save(fig, "auth_iam_jwt_rbac_abac.png")


def add_heading(doc: Document, text: str, level: int):
    doc.add_heading(text, level=level)


def add_req_block(doc: Document, rid: str, title: str, bullets: list[str]):
    p = doc.add_paragraph()
    run = p.add_run(f"{rid} — {title}")
    run.bold = True
    run.font.size = Pt(11)
    for b in bullets:
        doc.add_paragraph(b, style="List Bullet")


def add_grid_table(doc: Document, headers: tuple[str, ...], rows: list[tuple[str, ...]]):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = "Table Grid"
    for i, h in enumerate(headers):
        tbl.rows[0].cells[i].text = h
    for row in rows:
        cells = tbl.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = val


def add_project_mandatory_scope(doc: Document):
    """Stakeholder PDF: Billing Application – Functional & Calculation Logic Document."""
    add_heading(doc, "1.1 Mandatory baseline — stakeholder billing document", 2)
    doc.add_paragraph(
        "The following is restated from the project document Billing Application – Functional & Calculation Logic "
        "Document. This scope is mandatory for MVP: implementation MUST satisfy Section 1.1–1.6 and requirement IDs "
        "CORE-01 through CORE-15 in Section 4. Other sections of this specification are additive extensions unless "
        "explicitly adopted."
    )

    add_heading(doc, "1.2 Application overview & assumptions", 2)
    doc.add_paragraph("Application name: Billing Application.")
    doc.add_paragraph(
        "Purpose: create, manage, and track customer invoices; calculate taxes and totals; record payments; "
        "generate billing reports."
    )
    doc.add_paragraph("Target users (baseline personas):", style="List Bullet")
    doc.add_paragraph("Admin", style="List Bullet")
    doc.add_paragraph("Billing Staff", style="List Bullet")
    doc.add_paragraph("Accountant (read-only / reports)", style="List Bullet")
    doc.add_paragraph("Assumptions:", style="List Bullet")
    doc.add_paragraph("Single currency (design MAY allow future extension).", style="List Bullet")
    doc.add_paragraph("Percentage-based tax (GST/VAT).", style="List Bullet")
    doc.add_paragraph("Line-item–based invoices.", style="List Bullet")
    doc.add_paragraph("Decimal precision: 2 places; rounding mode round half up.", style="List Bullet")

    add_heading(doc, "1.3 Baseline user roles & permissions", 2)
    add_grid_table(
        doc,
        ("Role", "Permissions"),
        (
            ("Admin", "Full access, configuration, reports"),
            ("Billing Staff", "Create/edit invoices, customers"),
            ("Accountant", "View invoices, reports only"),
        ),
    )
    doc.add_paragraph()

    add_heading(doc, "1.4 Page-wise functional flow & calculation logic", 2)

    add_heading(doc, "1.4.1 Login page", 3)
    doc.add_paragraph("Purpose: authenticate users.")
    doc.add_paragraph("Fields: Username; Password.")
    doc.add_paragraph("Logic: validate credentials. No billing calculation on this page.")

    add_heading(doc, "1.4.2 Dashboard page", 3)
    doc.add_paragraph("Purpose: billing summary.")
    add_grid_table(
        doc,
        ("Metric", "Logic"),
        (
            ("Total Invoices (Today)", "Count of invoices created today"),
            ("Total Sales", "Sum of Invoice Grand Total"),
            ("Total Tax", "Sum of Invoice Tax Amount"),
            ("Pending Payments", "Sum of unpaid invoice balances"),
        ),
    )
    doc.add_paragraph()

    add_heading(doc, "1.4.3 Customer management", 3)
    doc.add_paragraph("Purpose: create and manage customers.")
    doc.add_paragraph(
        "Fields: Customer Name; Address; Phone; Email; GST type; GST; State (with state code); Credit Balance; "
        "opening balance (payable & receivable); four configurable Additional Fields labels (values printed on invoice)."
    )
    doc.add_paragraph("No tax/total calculations on this page beyond storing balances for reference.")

    add_heading(doc, "1.4.4 Product / service management", 3)
    doc.add_paragraph("Purpose: define billable items.")
    doc.add_paragraph(
        "Fields: Product Name; HSN code; category; Sale Price; Purchase Price; Wholesale Price & Qty; Tax Rate (%); "
        "Unit of Measure."
    )
    doc.add_paragraph(
        "Reporting expectation: profit indicator from Sale Price, Purchase Price, and Tax as defined in the "
        "stakeholder document (sale price − purchase price − tax relates to profit %)."
    )
    doc.add_paragraph("No invoice calculations here; master data used on invoice lines.")

    add_heading(doc, "1.4.5 Invoice creation (core billing)", 3)
    doc.add_paragraph("Invoice header: Invoice Number (auto-generated); Invoice Date; Customer; Due Date.")
    doc.add_paragraph(
        "Each line item: Product; Quantity; Unit Price (from product, editable); Discount (%) optional; "
        "Tax Rate (%) from product; Round off (nearest value of 1 per stakeholder doc); Line Total (calculated)."
    )
    doc.add_paragraph("Line item calculation logic (mandatory order):", style="List Bullet")
    doc.add_paragraph("Step 1 — GrossAmount = Quantity × UnitPrice", style="List Bullet")
    doc.add_paragraph("Step 2 — DiscountAmount = GrossAmount × (Discount% / 100)", style="List Bullet")
    doc.add_paragraph("Step 3 — TaxableAmount = GrossAmount − DiscountAmount", style="List Bullet")
    doc.add_paragraph("Step 4 — TaxAmount = TaxableAmount × (TaxRate% / 100)", style="List Bullet")
    doc.add_paragraph("Step 5 — LineTotal = TaxableAmount + TaxAmount", style="List Bullet")
    doc.add_paragraph("Invoice summary fields:", style="List Bullet")
    add_grid_table(
        doc,
        ("Field", "Calculation"),
        (
            ("Subtotal", "Σ TaxableAmount"),
            ("Total Discount", "Σ DiscountAmount"),
            ("Total Tax", "Σ TaxAmount"),
            ("Shipping / Other Charges", "Manual input"),
            ("Grand Total", "Subtotal + TotalTax + OtherCharges (rounded to 2 decimals)"),
        ),
    )
    doc.add_paragraph()

    add_heading(doc, "1.4.6 Invoice view / print", 3)
    doc.add_paragraph(
        "Display invoice details, lines, subtotal, tax breakdown, Grand Total, Paid Amount, Balance Due. "
        "BalanceDue = GrandTotal − PaidAmount."
    )

    add_heading(doc, "1.4.7 Payment recording", 3)
    doc.add_paragraph("Fields: Invoice Number; Payment Date; Payment Mode (Cash, Card, Bank); Paid Amount.")
    doc.add_paragraph("Partial payments supported: RemainingBalance = PreviousBalance − PaidAmount.")
    add_grid_table(
        doc,
        ("Condition", "Invoice status"),
        (
            ("PaidAmount = 0", "Unpaid"),
            ("PaidAmount < GrandTotal", "Partially Paid"),
            ("PaidAmount = GrandTotal", "Paid"),
        ),
    )
    doc.add_paragraph()

    add_heading(doc, "1.4.8 Credit note / refund", 3)
    doc.add_paragraph("Purpose: returns or billing corrections.")
    doc.add_paragraph("RefundAmount ≤ Original Invoice Amount.")
    doc.add_paragraph("AdjustedBalance = OriginalBalance − RefundAmount.")

    add_heading(doc, "1.4.9 Core reports (dashboard subset)", 3)
    doc.add_paragraph("Sales Report: TotalSales = Σ Invoice.GrandTotal over date range.")
    doc.add_paragraph("Tax Report: TotalTaxCollected = Σ Invoice.TotalTax.")
    doc.add_paragraph("Outstanding Payments Report: OutstandingAmount = Σ BalanceDue where BalanceDue > 0.")

    add_heading(doc, "1.5 Document modules (sale, purchase, cash)", 2)
    doc.add_paragraph("Sale: Sale invoice; Estimate / quotation; Payment-in entry; Sale order; Delivery challan; Sale return / Credit note (see 1.4.8).")
    doc.add_paragraph("Purchase: Purchase; Payment-out entry; Purchase order; Purchase return / Debit note.")
    doc.add_paragraph(
        "Cash & Bank: Bank account with formal entries derived from sale invoices and payment-in; opening balance "
        "as capital investment; digital amount tracking; Cash in Hand (physical cash); Cheque handling."
    )

    add_heading(doc, "1.6 Reports enumeration & non-functional requirements (PDF)", 2)
    doc.add_paragraph(
        "Reports SHALL be available for data fetch across required fields for: Sale; Purchase; All-fields report; "
        "Payment-in; Payment-out; Delivery challan; Credit note; Debit note; Sale order; Purchase order."
    )
    doc.add_paragraph("Non-functional requirements from stakeholder document:", style="List Bullet")
    doc.add_paragraph("Decimal precision: 2 digits (consistent with §1.2).", style="List Bullet")
    doc.add_paragraph("Secure authentication.", style="List Bullet")
    doc.add_paragraph("Role-based access (baseline roles in §1.3).", style="List Bullet")
    doc.add_paragraph("PDF invoice generation.", style="List Bullet")
    doc.add_paragraph("Audit trail for edits.", style="List Bullet")
    doc.add_paragraph(
        "Informative future enhancements (out of mandatory MVP unless promoted): multi-currency; recurring invoices; "
        "subscription billing; automatic tax rules; API integration; job-role–based price management extensions.",
        style="List Bullet",
    )

    doc.add_page_break()


def build_document(fig_paths: dict[str, Path]) -> Path:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    title = doc.add_heading("Billing Software — Requirements Specification", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    lock = doc.add_paragraph()
    lock.alignment = WD_ALIGN_PARAGRAPH.CENTER
    lr = lock.add_run("VERSION 1.0 — LOCKED")
    lr.bold = True
    lr.font.size = Pt(14)

    lock2 = doc.add_paragraph()
    lock2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    lr2 = lock2.add_run(
        "Frozen baseline for Version-1 project. Functional changes require Requirements v2 revision "
        "(see docs/REQUIREMENTS_V1_LOCK.md)."
    )
    lr2.italic = True
    lr2.font.size = Pt(10)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(
        "Mandatory MVP baseline from stakeholder Billing Application – Functional & Calculation Logic Document "
        "(Section 1 & CORE-* requirements). Extended themes (§3+) add marketplace catalog, advanced IAM, and suite "
        "capabilities beyond MVP.\nDocument generated for implementation planning."
    )
    r.italic = True
    r.font.size = Pt(10)

    doc.add_page_break()

    add_heading(doc, "1. References & inspiration", 1)
    doc.add_paragraph(
        "The following public product positioning pages informed this superset (feature names are generalized; "
        "implement per jurisdiction):",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Zoho — Cloud software suite for businesses: https://www.zoho.com/ (CRM, Books, unified apps).",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Vyapar — GST billing, inventory & accounting for Indian SMEs: https://vyaparapp.in/",
        style="List Bullet",
    )
    doc.add_paragraph(
        "MyBillBook — SMB GST billing segment (trial funnel): https://freetrial.mybillbook.in/",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Stakeholder Billing Application – Functional & Calculation Logic Document (PDF): authoritative MVP scope "
        "restated in §1.1–1.6; copy in repo: docs/Billing_Application_Functional_Reference.pdf",
        style="List Bullet",
    )

    add_project_mandatory_scope(doc)

    add_heading(doc, "2. Figures — DFD & conceptual diagrams", 1)
    doc.add_paragraph(
        "Structured analysis uses Data Flow Diagrams (DFD) to show boundaries, processes, and data stores. "
        "Lifecycle diagrams explain document sequencing.",
    )
    for key, caption in [
        ("context", "Context diagram (Level 0): external entities vs the billing suite."),
        ("level1", "Level 1 DFD: core processes and logical data stores."),
        ("lifecycle", "Billing lifecycle: quotation through payment and returns."),
        ("domains", "Capability domain map (market superset)."),
        ("catalog", "Product catalog taxonomy (marketplace-style categories, types, variants)."),
        ("auth", "Identity & access: JWT + refresh, RBAC + ABAC, IAM admin & delegation."),
    ]:
        doc.add_paragraph(caption, style="List Number")
        doc.add_picture(str(fig_paths[key]), width=Inches(6.3))
        doc.add_paragraph()

    doc.add_page_break()

    add_heading(doc, "3. Superset feature catalog (extended themes)", 1)
    doc.add_paragraph(
        "Themes below extend the MVP defined in §1. They span Zoho-style breadth, Vyapar/MyBillBook-class GST retail, "
        "marketplace catalog, and enterprise IAM. Prioritize after CORE-* delivery unless a theme is explicitly pulled "
        "into MVP.",
    )

    themes = [
        ("Core documents", "Invoice, quote/estimate, proforma, delivery challan, credit/debit note, receipt, purchase bill/GRN, PO, work orders."),
        ("Tax & compliance", "GST/VAT slabs, HSN/SAC, TDS/TCS, e-invoice IRN/QR, e-way generation/cancel hooks, statutory registers."),
        ("Inventory", "SKU, variants, batch/MRP/expiry, serial nos., multi-UOM, barcode/scanning, adjust/transfer, reorder alerts."),
        ("Parties & pricing", "Customer/vendor masters, credit limits & stops, price lists, discounts, schemes, ship-to/bill-to."),
        ("Payments & banking", "Cash/bank/UPI/card/cheque/wallet, split tenders, allocations, FX gains/losses if multi-currency."),
        ("AR/AP & collections", "Outstanding, aging, dunning cadence, payment links, bulk reminders (SMS/WhatsApp/email)."),
        ("Retail / POS", "Quick billing, park/hold, returns/exchange, cashier shifts, thermal/A4, offline-capable."),
        ("Purchasing & expenses", "Vendor bills, landed cost, GRNI, expense claims GST/non-GST, approvals."),
        ("Reporting & BI", "Financial statements, registers, MIS dashboards, cohort/item profitability, scheduled exports."),
        ("Platform", "Multi-org/fiscal years/branches/warehouses, IAM (JWT/RBAC/ABAC), field-level audit, backups encryption."),
        ("Digital extensions", "Online storefront/catalog orders, PG settlements import, OCR for expense snaps."),
        ("CRM / projects (optional)", "Leads/deals pipeline; quotes tied to opportunities; time & milestone billing."),
        ("Subscriptions & recurring", "Recurring invoices, usage tiers, proration, dunning for SaaS/service."),
        ("Integrations", "Email SMTP, SMS gateways, accounting bridges, payment gateways, e-commerce carts."),
        ("HR/Payroll (optional)", "Salary payouts, statutory deductions summaries feeding GL."),
        (
            "Catalog & taxonomy (marketplace-class)",
            "Multi-level categories; product types (physical/digital/service/bundle); attribute schemas & facets; "
            "listing (SPU) vs SKU variants; brand; compatibility with search/filter UX like large marketplaces.",
        ),
        (
            "Identity & access (IAM)",
            "JWT access + refresh rotation; RBAC (roles/permissions); ABAC policies; MFA/SSO optional; "
            "role admin UI; temporary delegation; API keys (M2M); session/device revoke; auth audit.",
        ),
    ]
    tbl = doc.add_table(rows=1, cols=2)
    tbl.style = "Table Grid"
    hdr = tbl.rows[0].cells
    hdr[0].text = "Theme"
    hdr[1].text = "Superset scope notes"
    for theme, note in themes:
        row = tbl.add_row().cells
        row[0].text = theme
        row[1].text = note

    add_heading(doc, "3.1 Product types & categories (Flipkart / Amazon–style handling)", 2)
    doc.add_paragraph(
        "Large marketplaces separate what customers browse (department → category → attributes/facets) "
        "from what warehouses stock (SKU = variant combination). Billing software should mirror that model "
        "so one catalogue supports electronics, apparel, grocery, pharmacy, digital goods, and services without "
        "hard-coding item shapes per industry."
    )
    doc.add_paragraph(
        "Core concepts (see Figure 5):",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Category tree — unlimited depth; optional multiple category placement per listing with one primary path for breadcrumbs.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Product type / template — defines behaviour: stocked vs non-stocked, serialised, batch/expiry, weight/count pricing, "
        "digital fulfilment (license key/file), service (duration/milestone), bundle/KIT (static or configurable BOM).",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Attribute schema — per category or product type; drives specs on PDP, POS picker facets, and compliance "
        "(e.g. medicine schedule, wattage, storage GB). Inherited attributes override at lower levels.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Listing (SPU) vs SKU — one merchandising product with images/long description; many SKUs for variant axes "
        "(e.g. Colour × Storage). Each SKU carries pricing, barcodes, dimensions, and inventory dimensions.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Bundles — priced assembly exploding to component SKUs at sale or at shipment (configurable); optional "
        "gift-box vs multipack semantics.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Operational hooks — category-level defaults for tax (HSN/SAC), low-stock alerts, return policy, "
        "and e-way threshold hints; still overridable per SKU.",
        style="List Bullet",
    )

    add_heading(doc, "3.2 Identity & access — JWT, RBAC, ABAC, delegation", 2)
    doc.add_paragraph(
        "Authentication proves who the principal is; authorization decides what they may do on each request. "
        "Enterprise billing needs strong IAM: short-lived access tokens, controlled refresh, fine-grained roles, "
        "and attribute-based rules for row-level and workflow-sensitive actions (see Figure 6)."
    )
    doc.add_paragraph(
        "JWT access token — signed (asymmetric preferred); carries stable subject (user/service id), tenant/org id, "
        "session id, optional role hints for UX only; authorization MUST re-evaluate permissions server-side (never trust claims alone for sensitive actions).",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Refresh token — opaque or signed with rotation on each use; detect reuse to revoke token family; bind to device fingerprint optionally.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "RBAC — permissions grouped into roles; users receive roles scoped by org/branch/warehouse; optional role hierarchy inheritance.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "ABAC — policies combining resource/user/environment attributes (e.g. invoice.branch_id == user.branch_id; "
        "amount < approval_limit; state == draft); explicit deny wins over allow.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Delegation — time-bound grant for subset of permissions or scoped objects (e.g. \"approve bills up to ₹X until Friday\"); full audit.",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Administration — CRUD roles/permissions (with migration-safe ids), user-role assignment effective dating, "
        "break-glass / support impersonation with mandatory dual-control audit.",
        style="List Bullet",
    )

    doc.add_page_break()

    add_heading(doc, "4. Detailed functional requirements", 1)
    doc.add_paragraph(
        "Requirements CORE-01 through CORE-15 are mandatory and trace to §1 (stakeholder billing document). "
        "Requirements FR-* are extensions; adopt per phase.",
    )

    reqs = [
        (
            "CORE-01",
            "Billing application purpose & numeric assumptions",
            [
                "Implement invoice lifecycle: create/manage/track invoices, tax/total calculation, payments, reports.",
                "Single currency MVP; architecture MAY allow later multi-currency without breaking stored amounts.",
                "Line-item invoices only; percentage GST/VAT per line from product master.",
                "All monetary storage and display use 2 decimal places with round-half-up unless superseded by locale pack.",
            ],
        ),
        (
            "CORE-02",
            "Baseline roles & access control",
            [
                "Admin: full access, configuration, reports.",
                "Billing Staff: create/edit invoices and customers.",
                "Accountant: view invoices and reports only (no destructive edits).",
                "Map to IAM implementation (FR-IAM-*) without weakening these boundaries.",
            ],
        ),
        (
            "CORE-03",
            "Login",
            [
                "Username + password authentication; credential validation before access to billing screens.",
                "No billing math executed on login route.",
            ],
        ),
        (
            "CORE-04",
            "Dashboard metrics",
            [
                "Total Invoices (Today): count invoices whose creation date is today.",
                "Total Sales: sum Invoice Grand Total over dashboard scope (default all-time or as configured).",
                "Total Tax: sum Invoice tax amount field.",
                "Pending Payments: sum unpaid invoice balances (Σ BalanceDue for unpaid + partial).",
            ],
        ),
        (
            "CORE-05",
            "Customer master",
            [
                "Capture Name, Address, Phone, Email, GST type, GST identifier, State + state code.",
                "Credit Balance; opening balances payable and receivable.",
                "Four configurable additional field labels whose values print on invoice layout.",
            ],
        ),
        (
            "CORE-06",
            "Product / service master",
            [
                "Fields: Name, HSN, category, Sale Price, Purchase Price, Wholesale Price & Qty, Tax Rate (%), UOM.",
                "Support profitability insight per stakeholder formula linking sale, purchase, and tax.",
                "Values feed invoice lines; no invoice totals computed on product screen.",
            ],
        ),
        (
            "CORE-07",
            "Invoice header & lines",
            [
                "Auto invoice number; Invoice Date; Customer reference; Due Date.",
                "Lines: product, quantity, unit price editable from default, optional line discount %, tax rate from product, "
                "round-off per line per stakeholder rule (nearest value of 1 — implement consistently with currency).",
                "Enforce calculation pipeline exactly: GrossAmount = Qty×Price; DiscountAmount; TaxableAmount; TaxAmount; LineTotal.",
            ],
        ),
        (
            "CORE-08",
            "Invoice summary totals",
            [
                "Subtotal = Σ TaxableAmount; Total Discount = Σ DiscountAmount; Total Tax = Σ TaxAmount.",
                "Shipping/Other Charges manual entry.",
                "GrandTotal = Subtotal + TotalTax + OtherCharges; round final to 2 decimals.",
            ],
        ),
        (
            "CORE-09",
            "Invoice display & balance due",
            [
                "Invoice view/print shows lines, subtotal, tax breakdown, Grand Total, Paid Amount, Balance Due.",
                "BalanceDue = GrandTotal − PaidAmount.",
            ],
        ),
        (
            "CORE-10",
            "Payments against invoices",
            [
                "Record Payment Date, Mode (Cash, Card, Bank), Paid Amount against Invoice Number.",
                "Partial payments: update RunningBalance = PreviousBalance − PaidAmount.",
                "Statuses: Unpaid (paid=0), Partially Paid (0<paid<grand), Paid (paid=grand).",
            ],
        ),
        (
            "CORE-11",
            "Credit note / refund",
            [
                "RefundAmount must not exceed original invoice amount context.",
                "AdjustedBalance = OriginalBalance − RefundAmount after posting.",
            ],
        ),
        (
            "CORE-12",
            "Reports — sales, tax, outstanding",
            [
                "Sales report: Σ GrandTotal by date range.",
                "Tax report: Σ TotalTax collected.",
                "Outstanding: Σ BalanceDue where BalanceDue > 0.",
            ],
        ),
        (
            "CORE-13",
            "Sale module documents",
            [
                "Support flows/documents: Sale invoice, Estimate/quotation, Payment-in, Sale order, Delivery challan, Sale return/Credit note.",
            ],
        ),
        (
            "CORE-14",
            "Purchase module documents",
            [
                "Support: Purchase bill/entry, Payment-out, Purchase order, Purchase return/Debit note.",
            ],
        ),
        (
            "CORE-15",
            "Cash & bank plus reporting breadth & PDF NFR",
            [
                "Bank ledger with formal entries integrating sale invoices and payment-in; opening balance / capital investment; "
                "digital amounts.",
                "Cash in Hand tracking for physical cash; Cheque instrument lifecycle minimal support.",
                "Reports SHALL expose required fields for: Sale, Purchase, All-fields, Payment-in/out, Delivery challan, "
                "Credit note, Debit note, Sale order, Purchase order.",
                "Generate invoice PDF output; secure authentication; RBAC per CORE-02; immutable audit trail for edits.",
            ],
        ),
        (
            "FR-DOC-01",
            "Document authoring & templates",
            [
                "Configurable numbering series per branch/document type with gaps/audit.",
                "Multiple print themes (A4/A5, thermal 2\"/3\"); logo, footer, terms.",
                "Convert estimate→SO→DC→invoice without re-keying; preserve linkage IDs.",
                "Digital share: PDF, email, WhatsApp deep-link placeholders.",
            ],
        ),
        (
            "FR-TAX-02",
            "Tax engine",
            [
                "Line-level tax breakdown (CGST/SGST/IGST or VAT/sales tax per region).",
                "Place-of-supply rules for interstate/intrastate.",
                "E-invoice payload generation & IRN storage when jurisdiction mandates.",
                "Credit/debit note referencing original invoice for compliance.",
            ],
        ),
        (
            "FR-INV-03",
            "Inventory coupling",
            [
                "Real-time stock reservation or deduction policy per document stage.",
                "Negative stock policy configurable per SKU/category.",
                "Batch/expiry picking logic for FEFO/FIFO hints.",
                "Physical stocktake workflow with variance posting.",
            ],
        ),
        (
            "FR-PAY-04",
            "Payments & settlement",
            [
                "Split tenders on POS; partial invoice settlements.",
                "Vendor payments with TDS tracking placeholders.",
                "Cheque lifecycle (issued/received/cleared/bounced).",
                "UPI QR on invoice template + reconciliation reference capture.",
            ],
        ),
        (
            "FR-BANK-05",
            "Banking reconciliation",
            [
                "Import CSV/OFX; suggest matches by amount/date/reference.",
                "Manual match UI with audit.",
                "Roll-forward unreconciled items.",
            ],
        ),
        (
            "FR-REP-06",
            "Reporting",
            [
                "Trial balance, day book, cash/bank books.",
                "GST summary mimicking GSTR-1/3B data cuts (labels per country pack).",
                "Dashboard KPIs: sales, gross margin, stock aging, outstanding.",
                "Scheduled email reports optional.",
            ],
        ),
        (
            "FR-SEC-07",
            "Security & governance (platform)",
            [
                "Immutable audit log for masters, financial docs, and IAM configuration changes.",
                "Tenant/company-level data isolation; encryption at rest for secrets and backup blobs.",
                "Backup/restore: local + cloud destination support; key rotation procedures documented.",
                "Secrets not logged; centralized config for token signing keys with rollover.",
            ],
        ),
        (
            "FR-IAM-17",
            "Authentication & JWT lifecycle",
            [
                "Issue access JWT with configurable TTL (recommended ≤ 15 minutes API / aligned to risk); include jti for revocation tracking.",
                "Issue refresh token with longer TTL; rotate refresh on each refresh call; on reused refresh detect compromise and revoke family.",
                "Support revoke: single session, all sessions for user, org-wide emergency revoke.",
                "Password-based login with strong hashing (e.g. Argon2id/bcrypt), lockout/backoff, optional breached-password check.",
                "Optional MFA: TOTP and/or WebAuthn/FIDO2; step-up MFA for high-risk actions (void invoice, payout).",
                "Enterprise SSO: OIDC and/or SAML 2.0 inbound; map IdP groups to application roles (configurable).",
                "Machine-to-machine: scoped API keys or client-credentials OAuth with rotate/revoke and least-privilege scopes.",
                "Document binding for mobile/desktop (PKCE for public clients where applicable).",
            ],
        ),
        (
            "FR-IAM-18",
            "RBAC, ABAC & enforcement",
            [
                "Permission model: fine-grained resource:action (e.g. invoice:create, invoice:approve, stock:adjust, report:export).",
                "Roles aggregate permissions; users hold multiple roles; effective permission = union minus explicit denies.",
                "Scopes: org/tenant, branch, warehouse — enforced so APIs cannot access cross-scope IDs without policy.",
                "ABAC policy engine: JSON/Rego-style or equivalent; attributes from user profile, resource, environment (time, IP allowlist).",
                "Row-level rules: e.g. cashier sees only own shifts; branch manager sees branch ledger only.",
                "Separation of duties: mutually exclusive role pairs configurable (e.g. creator vs approver on payments).",
                "Central PDP invocation on each protected endpoint; cache decisions with short TTL invalidating on IAM changes.",
                "Deny-by-default when policy evaluation fails closed; structured denial reasons for support audit.",
            ],
        ),
        (
            "FR-IAM-19",
            "Role & permission administration; delegation",
            [
                "Admin UI: create/edit/disable roles; clone role; version permission sets with deprecation warnings.",
                "Bulk assign roles to users; effective-from / effective-to dates; preview effective permissions.",
                "Permission catalog grouped by module; export matrix role × permission for compliance reviews.",
                "Delegation wizard: delegator selects delegatee, permission subset or role slice, scope (branch/doc type), "
                "start/end datetime; notifications and automatic expiry.",
                "Delegation cannot exceed delegator's effective rights; circular delegation prevented.",
                "Break-glass impersonation: super-admin only, ticket/reference required, time-bound, full audit trail visible to tenant.",
                "Service accounts for integrations with scoped roles; rotate credentials without user passwords.",
                "Rate limiting & anomaly signals per principal (failed auth, privilege probing).",
            ],
        ),
        (
            "FR-SYNC-08",
            "Connectivity",
            [
                "Offline-first mobile/desktop sync model where required.",
                "REST/webhooks for orders/payments with idempotency keys.",
                "Webhook retries & DLQ monitoring.",
            ],
        ),
        (
            "FR-MAS-09",
            "Master data management",
            [
                "Items linked to category tree, brands, and attribute schemas; alternate units; MRP tracking.",
                "Party KYC fields: GSTIN/PAN, MSME flag, default payment terms.",
                "Warehouse/bin hierarchy; transfer templates.",
                "Import/export CSV for bulk onboarding.",
            ],
        ),
        (
            "FR-POS-10",
            "Point of sale",
            [
                "Keyboard shortcuts & barcode-first item entry.",
                "Shift open/close with cash denomination summary.",
                "Returns with reference to historical bill.",
                "Weighing scale integration hook (optional hardware profile).",
            ],
        ),
        (
            "FR-EWAY-11",
            "Logistics compliance",
            [
                "E-way payload assembly from invoice/DC including transporter ID & vehicle.",
                "Part-B updates & cancellation lifecycle.",
                "Distance/pin validation per API provider rules.",
            ],
        ),
        (
            "FR-MCUR-12",
            "Multi-currency & overseas (Zoho Books–class)",
            [
                "Transaction currency vs base currency with daily FX rate table.",
                "Realized/unrealized gain/loss postings optional module.",
                "Export packing list / commercial invoice templates.",
            ],
        ),
        (
            "FR-REC-13",
            "Recurring revenue",
            [
                "Subscription schedules generating invoices on cron.",
                "Pause/resume; proration policies.",
                "Retry failed charges with customer notification templates.",
            ],
        ),
        (
            "FR-COLL-14",
            "Collections automation",
            [
                "Configurable reminder templates per aging bucket.",
                "Bulk send with rate limiting per channel.",
                "Payment receipt auto-match via references/UPI RRNs.",
            ],
        ),
        (
            "FR-DASH-15",
            "Executive dashboards",
            [
                "Configurable widgets: sales vs target, top SKUs, stock-outs.",
                "Role-specific landing layouts.",
                "Drill-down to voucher level.",
            ],
        ),
        (
            "FR-CAT-16",
            "Marketplace-class catalog, categories & product types",
            [
                "Maintain navigational category tree (N-level); drag-drop reorder; deactivate without deleting historic transactions.",
                "Support multiple categories per listing with a single primary category for breadcrumb and SEO slug rules.",
                "Product types/templates: Physical (stocked), Digital (download/license, no stock or licence pool), "
                "Service (non-stock, timesheet/milestone optional), Bundle/KIT (BOM), Serialized, Perishable (batch/expiry mandatory).",
                "Variant builder: define variant axes (e.g. Color, Size); validate Cartesian SKUs; optional open 'misc' variant for clearance.",
                "Attribute schema inheritance from category/product type; facet types (enum, number, boolean, text); "
                "required vs optional; visibility on POS/web/catalog API.",
                "SKU-level overrides for tax (HSN/SAC), MRP, dimensions, reorder/min-max, serial tracking, shelf life.",
                "Brand and manufacturer as first-class masters; optional model/part numbers for electronics/spares compatibility lists.",
                "Tags/keywords distinct from browse categories for merchandising campaigns.",
                "Listing readiness workflow (draft → QC → published) optional for multi-operator catalogs.",
                "Invoice/POS lines always reference SKU or non-stock service line; bundles explode per defined policy with audit trail.",
                "Import/export: bulk category assignment, attribute columns per product type, variant matrix spreadsheet template.",
                "API: resolve slug/category facet filters to SKU IDs for cart/checkout integrations (marketplace-style).",
            ],
        ),
    ]
    for rid, title, bullets in reqs:
        add_req_block(doc, rid, title, bullets)

    add_heading(doc, "5. Non-functional requirements", 1)
    nfr = [
        ("NFR-PERF", "P95 invoice save < 300 ms LAN; POS scan-to-bill under 2 s median."),
        ("NFR-REL", "RPO ≤ 15 minutes with automated backups; RTO target defined per deployment."),
        ("NFR-ACC", "Monetary calculations decimal-safe; rounding policy documented per currency."),
        ("NFR-LEG", "Localization packs for tax/document wording; timezone-aware timestamps."),
        ("NFR-A11Y", "WCAG-oriented targets for web UI where applicable."),
        ("NFR-AUTH", "JWT validation ≤ 5 ms median locally; clock skew ≤ 120 s; signing keys rotated ≤ 90 days."),
        ("NFR-IAM", "Authorization PDP adds ≤ 20 ms P95 per request at gateway when cached policies warm."),
        ("NFR-TOK", "Refresh tokens stored hashed server-side; never emit refresh token in URL query strings."),
    ]
    for rid, txt in nfr:
        p = doc.add_paragraph(style="List Bullet")
        r = p.add_run(f"{rid}: ")
        r.bold = True
        p.add_run(txt)

    add_heading(doc, "6. Data dictionary (logical)", 1)
    doc.add_paragraph(
        "Maps to Figure 2 stores: D1 masters (parties, items, tax schemas, warehouses); "
        "D2 transactional headers/lines/payments; D3 quantity ledger & costing layers; "
        "D4 GL postings derived from sub-ledgers. Physical schema is implementation-specific.",
    )
    doc.add_paragraph(
        "Catalog extensions in D1: category_nodes (tree), product_types, attribute_definitions, products_listings (SPU), "
        "product_variants (SKU), listing_category_map, bundle_components. Transactions in D2 reference variant_id / SKU.",
    )
    doc.add_paragraph(
        "IAM extensions (logical): users, credentials/credential_history, sessions_refresh_tokens (family id), "
        "roles, permissions, role_permission, user_role (scopes: org_id, branch_id), abac_policies, delegations, "
        "api_clients / service_accounts, auth_audit_events, iam_admin_audit. PDP reads these stores per request.",
    )
    doc.add_paragraph(
        "MVP extensions aligned with stakeholder PDF (§1): customers (including GST fields, opening balances, four "
        "invoice-print labels); products/services (HSN, category, prices, wholesale qty, tax %); invoices_header/lines "
        "with calculated taxable/tax/grand totals; payments_allocation; credit_notes; sale_orders; delivery_challans; "
        "purchase_documents; payment_in/out; bank_accounts; cash_ledger; cheque_register; audit_log_entries.",
    )

    add_heading(doc, "7. Traceability note", 1)
    doc.add_paragraph(
        "Phase 0 (MVP): implement CORE-01..CORE-15 exactly as §1; satisfy stakeholder Billing Application functional PDF. "
        "Phase 1+: layered FR-* items (documents, tax depth, inventory, POS, IAM hardening, marketplace catalog). "
        "Map CORE-* to acceptance tests derived from §1.4 calculation tables."
    )

    out = ROOT / "Billing_Software_Requirements_Specification.docx"
    fallbacks = [
        ROOT / "Billing_Software_Requirements_Specification_build.docx",
        ROOT / "Billing_Software_Requirements_Specification_latest.docx",
    ]
    for path in [out] + fallbacks:
        try:
            doc.save(path)
            return path
        except PermissionError:
            continue
    from datetime import datetime
    stamped = ROOT / f"Billing_Software_Requirements_Specification_{datetime.now():%Y%m%d_%H%M%S}.docx"
    doc.save(stamped)
    return stamped


def main():
    fig_paths = {
        "context": draw_context_dfd(),
        "level1": draw_level1_dfd(),
        "lifecycle": draw_billing_lifecycle(),
        "domains": draw_module_overview(),
        "catalog": draw_catalog_taxonomy(),
        "auth": draw_auth_architecture(),
    }
    out = build_document(fig_paths)
    print(f"Wrote: {out}")
    for k, p in fig_paths.items():
        print(f"  {k}: {p}")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
