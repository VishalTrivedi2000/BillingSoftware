using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize(Policy = "perm:" + PermissionNames.InvoicesRead)]
[Route("api/v1/sales")]
public sealed class SalesController : ControllerBase
{
    private readonly IInvoiceRepository _invoices;

    public SalesController(IInvoiceRepository invoices) => _invoices = invoices;

    /// <summary>Invoice-derived aggregates for the sales workspace (collections vs outstanding).</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<SalesSummaryDto>> Summary(CancellationToken ct)
    {
        var dto = await _invoices.GetSalesSummaryAsync(ct).ConfigureAwait(false);
        return Ok(dto);
    }
}
