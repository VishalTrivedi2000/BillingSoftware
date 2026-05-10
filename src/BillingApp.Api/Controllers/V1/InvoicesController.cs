using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/invoices")]
public sealed class InvoicesController : ControllerBase
{
    private readonly IInvoiceRepository _invoices;

    public InvoicesController(IInvoiceRepository invoices) => _invoices = invoices;

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.InvoicesRead)]
    public async Task<ActionResult<IReadOnlyList<InvoiceSummaryDto>>> List(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        [FromQuery] DateOnly? issueFrom = null,
        [FromQuery] DateOnly? issueTo = null,
        CancellationToken ct = default)
    {
        DateTime? issueFromUtc = issueFrom is null
            ? null
            : DateTime.SpecifyKind(issueFrom.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        DateTime? issueToUtcExclusive = issueTo is null
            ? null
            : DateTime.SpecifyKind(issueTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var rows = await _invoices.ListAsync(Math.Max(0, skip), Math.Clamp(take, 1, 500), issueFromUtc, issueToUtcExclusive, ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{invoiceId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.InvoicesRead)]
    public async Task<ActionResult<InvoiceDetailDto>> Get(long invoiceId, CancellationToken ct)
    {
        var row = await _invoices.GetDetailAsync(invoiceId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.InvoicesCreate)]
    public async Task<ActionResult<object>> Create([FromBody] CreateInvoiceRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _invoices.CreateAsync(request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { invoiceId = id }, new { invoiceId = id });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{invoiceId:long}/payments")]
    [Authorize(Policy = "perm:" + PermissionNames.InvoicePaymentsRecord)]
    public async Task<ActionResult<object>> RecordPayment(long invoiceId, [FromBody] RecordInvoicePaymentRequest request, CancellationToken ct)
    {
        try
        {
            var paymentId = await _invoices.RecordPaymentAsync(invoiceId, request, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { invoiceId }, new { invoicePaymentId = paymentId });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
    }
}
