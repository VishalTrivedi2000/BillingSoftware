using System.Data.Common;

namespace BillingApp.Application.Abstractions.Data;

public interface IDbConnectionFactory
{
    Task<DbConnection> CreateOpenConnectionAsync(CancellationToken cancellationToken = default);
}
