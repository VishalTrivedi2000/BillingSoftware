using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/customers")]
public sealed class CustomersController : ControllerBase
{
    private readonly ICustomerRepository _customers;

    public CustomersController(ICustomerRepository customers) => _customers = customers;

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.CustomersRead)]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> List([FromQuery] int max = 200, CancellationToken ct = default)
    {
        var rows = await _customers.ListAsync(Math.Clamp(max, 1, 500), ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{customerId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.CustomersRead)]
    public async Task<ActionResult<CustomerDto>> Get(long customerId, CancellationToken ct)
    {
        var row = await _customers.GetAsync(customerId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.CustomersCreate)]
    public async Task<ActionResult<object>> Create([FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        var id = await _customers.CreateAsync(
            request with { Name = request.Name.Trim() },
            ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { customerId = id }, new { customerId = id });
    }

    [HttpPatch("{customerId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.CustomersUpdate)]
    public async Task<IActionResult> Update(long customerId, [FromBody] UpdateCustomerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        var ok = await _customers.UpdateAsync(customerId, request with { Name = request.Name.Trim() }, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }
}
