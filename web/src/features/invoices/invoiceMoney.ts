/** Match Sql Decimal.Round(..., 2, MidpointRounding.AwayFromZero) for positive money amounts used on invoices. */
export function roundMoney2(amount: number): number {
  const scaled = amount * 100;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / 100;
}
