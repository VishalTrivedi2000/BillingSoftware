using BillingApp.Application.Abstractions.Billing;
using BillingApp.Application.Billing;
using BillingApp.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BillingApp.Api.Controllers.V1;

[ApiController]
[Authorize]
[Route("api/v1/parties")]
public sealed class PartiesController : ControllerBase
{
    private readonly IPartyRepository _parties;

    public PartiesController(IPartyRepository parties) => _parties = parties;

    [HttpGet]
    [Authorize(Policy = "perm:" + PermissionNames.PartiesRead)]
    public async Task<ActionResult<IReadOnlyList<PartyDto>>> List([FromQuery] int max = 200, CancellationToken ct = default)
    {
        var rows = await _parties.ListAsync(Math.Clamp(max, 1, 500), ct).ConfigureAwait(false);
        return Ok(rows);
    }

    [HttpGet("{partyId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.PartiesRead)]
    public async Task<ActionResult<PartyDto>> Get(long partyId, CancellationToken ct)
    {
        var row = await _parties.GetAsync(partyId, ct).ConfigureAwait(false);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = "perm:" + PermissionNames.PartiesManage)]
    public async Task<ActionResult<object>> Create([FromBody] CreatePartyRequest request, CancellationToken ct)
    {
        var kind = PartyKinds.Normalize(request.Kind);
        if (string.IsNullOrEmpty(kind))
            return BadRequest("Kind must be Customer, Vendor, or Other.");

        var displayName = (request.DisplayName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(displayName))
            return BadRequest("Display name is required.");

        var body = new CreatePartyRequest(
            kind,
            displayName,
            TrimNull(request.LegalName),
            TrimNull(request.TaxId),
            TrimNull(request.Email),
            TrimNull(request.Phone),
            TrimNull(request.Notes));

        var id = await _parties.CreateAsync(body, ct).ConfigureAwait(false);
        return CreatedAtAction(nameof(Get), new { partyId = id }, new { partyId = id });
    }

    [HttpPatch("{partyId:long}")]
    [Authorize(Policy = "perm:" + PermissionNames.PartiesManage)]
    public async Task<IActionResult> Update(long partyId, [FromBody] UpdatePartyRequest request, CancellationToken ct)
    {
        var kind = PartyKinds.Normalize(request.Kind);
        if (string.IsNullOrEmpty(kind))
            return BadRequest("Kind must be Customer, Vendor, or Other.");

        var displayName = (request.DisplayName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(displayName))
            return BadRequest("Display name is required.");

        var body = new UpdatePartyRequest(
            kind,
            displayName,
            TrimNull(request.LegalName),
            TrimNull(request.TaxId),
            TrimNull(request.Email),
            TrimNull(request.Phone),
            TrimNull(request.Notes),
            request.IsActive);

        var ok = await _parties.UpdateAsync(partyId, body, ct).ConfigureAwait(false);
        return ok ? NoContent() : NotFound();
    }

    private static string? TrimNull(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return null;
        var t = s.Trim();
        return t.Length == 0 ? null : t;
    }
}
