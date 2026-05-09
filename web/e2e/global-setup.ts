/**
 * Ensures BillingApp.Api is up before Chromium tests (Vite proxy forwards /api → :5151).
 */
export default async function globalSetup(): Promise<void> {
  const origin = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:5151';
  const urls = [`${origin}/swagger/index.html`, `${origin}/swagger/v1/swagger.json`];
  const deadline = Date.now() + 120_000;

  let lastErr: unknown;
  while (Date.now() < deadline) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { redirect: 'follow' });
        if (res.ok) {
          console.info(`[e2e global-setup] API ready: ${url} (${res.status})`);
          return;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(
    `Billing API not reachable at ${origin} after 120s. Start it with:\n` +
      `  dotnet run --project src/BillingApp.Api/BillingApp.Api.csproj --urls http://127.0.0.1:5151\n` +
      `Last error: ${lastErr}`,
  );
}
