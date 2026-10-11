# Security tests

Automated security test suite for the PickAndSync API. It fires real attacks
(auth bypass, IDOR, privilege escalation, mass assignment, injection, stored
XSS, payment tampering, forged webhooks, rate limiting, CORS, headers) at a
**running** server and reports, per case, whether the server behaved securely.

- **Catalogue of cases:** [`SECURITY_TEST_CASES.md`](./SECURITY_TEST_CASES.md)
- **Runner:** [`run-security-tests.mjs`](./run-security-tests.mjs)

## ⚠️ Safety

Run **only** against a local or staging server backed by a **throwaway
database**. The suite creates users and fixtures (and deletes them afterwards),
sends injection payloads, and floods the auth endpoint to trip rate limiting.
It refuses to run if `SEC_BASE` points at a `pickandsync.com` host, but you are
responsible for not aiming it at real data.

## Prerequisites

- The API running locally against a disposable Postgres (e.g. an embedded or
  Docker Postgres), with migrations applied.
- `@prisma/client` generated and `jsonwebtoken` installed — both are already
  backend dependencies, so run the suite from `backend/` (or anywhere its
  `node_modules` resolves).

## Run

```bash
# from backend/ (so @prisma/client and jsonwebtoken resolve)
SEC_BASE="http://localhost:5077" \
DATABASE_URL="postgres://user:pass@localhost:5432/pickandsync_test" \
JWT_SECRET="<the same JWT_SECRET the server uses>" \
node ../security-tests/run-security-tests.mjs
```

`JWT_SECRET` must match the server's so the suite can mint valid test tokens.
`DATABASE_URL` must point at the **same** database the server uses, so seeded
fixtures are visible to it.

> **Run the server with Cashfree *configured* (non-mock).** Case **E3** (forged
> webhook) is only meaningful when the server has Cashfree keys set and
> `CASHFREE_MOCK=false`. In mock mode a top-up credits by design, so E3 will
> report a false failure. Dummy keys are fine — the point is that the webhook
> path re-checks the order with the provider instead of trusting the payload.

### Options

| Env var | Default | Purpose |
|---|---|---|
| `SEC_BASE` | `http://localhost:5077` | Base URL of the running API. |
| `DATABASE_URL` | — | Test database (same one the server uses). |
| `JWT_SECRET` | — | The server's JWT secret (to sign test tokens). |
| `SEC_KEEP` | unset | Set to `1` to keep seeded rows for debugging. |

## Output & exit code

Each case prints `[PASS]` (secure) or `[FAIL]` (vulnerable) with a short
detail, then a summary and a count of failures by severity. The process exits
**1** if any **critical or high** case fails, else **0** — so it can gate CI.

## Adding a case

Add a `check({ id, name, category, severity, pass, detail })` call inside
`run()` in the runner, where `pass` is `true` when the server did the secure
thing, and document it in `SECURITY_TEST_CASES.md`.
