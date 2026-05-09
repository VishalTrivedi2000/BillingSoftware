# Requirements Specification — Version 1.0 LOCKED

**Status:** FROZEN for Version-1 project baseline  
**Effective:** 2026-05-09  
**Scope authority:** `docs/Billing_Application_Functional_Reference.pdf` + Requirements Specification §1.1–1.6 + requirement IDs **CORE-01 … CORE-15**

## Rules

1. **No silent scope creep** — Changes to functional behaviour, calculations in §1.4.5–1.4.7, or CORE-* IDs require a **Requirements v2** revision (new doc version + stakeholder sign-off).
2. **Additive extensions only** — FR-* / marketplace / advanced IAM items remain **optional phases** unless explicitly promoted into v2.
3. **Implementation Plan v1** — Architecture and phased delivery are documented in `docs/IMPLEMENTATION_PLAN_V1.md` and `docs/Billing_App_Implementation_Plan_V1.docx` (generated).
4. **Traceability** — Acceptance tests MUST map to CORE-* and §1 calculation tables before marking MVP complete.

## Regenerating locked specification artifact

```powershell
python docs/generate_billing_requirements_docx.py
```

Locked wording appears on the generated Requirements Specification cover/subtitle.
