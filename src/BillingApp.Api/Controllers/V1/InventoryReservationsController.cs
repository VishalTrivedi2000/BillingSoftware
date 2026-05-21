using BillingApp.Api.Authorization;
using BillingApp.Application.Abstractions.Inventory;
using BillingApp.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/inventory/reservations")]
public sealed class InventoryReservationsController : ControllerBase
{
    private readonly IInventoryReservationRepository _reservations;

    public InventoryReservationsController(IInventoryReservationRepository reservations)
    {
        _reservations = reservations;
    }

    [HttpGet]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<IReadOnlyList<ReservationSummaryDto>>> List(
        [FromQuery] string? status,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var rows = await _reservations.ListAsync(
            string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
            Math.Max(0, skip),
            Math.Clamp(take, 1, 500), ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{reservationId:long}")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryRead)]
    public async Task<ActionResult<ReservationDto>> Get(long reservationId, CancellationToken ct)
    {
        var row = await _reservations.GetAsync(reservationId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReserve)]
    public async Task<ActionResult<object>> Create([FromBody] CreateReservationRequest request, CancellationToken ct)
    {
        try
        {
            var id = await _reservations.CreateAsync(request, User?.Identity?.Name, ct).ConfigureAwait(false);
            return CreatedAtAction(nameof(Get), new { reservationId = id }, new { reservationId = id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{reservationId:long}/release")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReserve)]
    public async Task<IActionResult> Release(long reservationId, CancellationToken ct)
    {
        try
        {
            var ok = await _reservations.ReleaseAsync(reservationId, User?.Identity?.Name, ct).ConfigureAwait(false);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("expire-due")]
    [Authorize(Policy = PolicyNames.BuiltIn.InventoryReserve)]
    public async Task<IActionResult> ExpireDue(CancellationToken ct)
    {
        var ok = await _reservations.ExpireDueAsync(ct).ConfigureAwait(false);
        return Ok(new { expired = ok });
    }
}
