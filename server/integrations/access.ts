/**
 * Site integrations are switched on per account with the server-only
 * INTEGRATION_ALLOWED_EMAILS variable (comma-separated). Nobody else sees or
 * can call them.
 */
export function integrationsAllowed(email: string): boolean {
  const allowed = (process.env.INTEGRATION_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
