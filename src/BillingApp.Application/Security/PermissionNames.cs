namespace BillingApp.Application.Security;

/// <summary>Central permission registry — align with JWT claims and authorization policies.</summary>
public static class PermissionNames
{
    public const string SystemHealth = "system.health";

    public const string UsersRead = "users.read";
    public const string UsersManage = "users.manage";

    public const string RolesRead = "roles.read";
    public const string RolesManage = "roles.manage";

    public const string DelegationsManage = "delegations.manage";

    public const string InvoicesCreate = "invoices.create";
    public const string InvoicesRead = "invoices.read";
    public const string InvoicesUpdate = "invoices.update";

    /// <summary>Record money collected against a posted invoice (settlement ledger).</summary>
    public const string InvoicePaymentsRecord = "invoicePayments.record";

    public const string PurchasesRead = "purchases.read";
    public const string PurchasesCreate = "purchases.create";

    public const string CustomersRead = "customers.read";
    public const string CustomersCreate = "customers.create";
    public const string CustomersUpdate = "customers.update";

    public const string ProductsRead = "products.read";
    public const string ProductsManage = "products.manage";

    public const string ReportsRead = "reports.read";

    public const string TenantsRead = "tenants.read";
    public const string TenantsManage = "tenants.manage";
    public const string OrganizationsRead = "organizations.read";
    public const string OrganizationsManage = "organizations.manage";

    public const string PartiesRead = "parties.read";
    public const string PartiesManage = "parties.manage";

    public static IReadOnlyList<string> All { get; } =
    [
        SystemHealth,
        UsersRead,
        UsersManage,
        RolesRead,
        RolesManage,
        DelegationsManage,
        InvoicesCreate,
        InvoicesRead,
        InvoicesUpdate,
        InvoicePaymentsRecord,
        PurchasesRead,
        PurchasesCreate,
        CustomersRead,
        CustomersCreate,
        CustomersUpdate,
        ProductsRead,
        ProductsManage,
        ReportsRead,
        TenantsRead,
        TenantsManage,
        OrganizationsRead,
        OrganizationsManage,
        PartiesRead,
        PartiesManage,
    ];
}
