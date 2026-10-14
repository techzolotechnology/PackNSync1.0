export function getClaimsProvider() {
  return { name: 'disabled', async fileClaim() {
    const error = new Error('Insurance submission is disabled. Use Reports and Disputes for human review.');
    error.statusCode = 409;
    throw error;
  } };
}
