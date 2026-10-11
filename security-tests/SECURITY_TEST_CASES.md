# PickAndSync — Security Test Cases

A catalogue of the security checks run against the PickAndSync API, with the
attack performed, the expected **secure** result, and severity. The automated
suite [`run-security-tests.mjs`](./run-security-tests.mjs) executes every case
against a running server and reports pass (secure) / fail (vulnerable).

- **Scope:** backend REST API (`/api/*`) and the share-link preview pages.
- **Method:** black-box attacks over HTTP, plus direct database read-back for
  state-change cases (e.g. mass assignment), against a local server with a
  throwaway database.
- **A test "passes" when the server behaves securely** — rejects the attack,
  does not change data it should not, or does not leak.
- **Never run against production.** Payloads and rate-limit floods pollute data.

Last full run: **31 / 31 passing** after the fixes below.

---

## How to read severity

| Severity | Meaning |
|---|---|
| critical | Account takeover, money theft, auth bypass, or admin access. |
| high | Cross-user data change/leak, privilege gain, or verification bypass. |
| medium | Hardening gap that enables an attack chain. |
| low | Defence-in-depth / error-handling hygiene. |

---

## A. Authentication & session

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| A1 | Call a protected route (`GET /wallet`) with no token. | 401 Unauthorized. | high |
| A2 | Forge a JWT with `"alg":"none"` and an empty signature, claiming the victim's id. | Rejected (401). | critical |
| A3 | Present a JWT signed with the wrong secret. | Rejected (401). | critical |
| A4 | Sign a token for the victim's id with a wrong secret and call `GET /auth/me`. | Rejected (401); no victim data. | critical |
| A5 | Present an expired (but correctly signed) access token. | Rejected (401). | high |
| A6 | Use a valid token belonging to a **banned** account. | 403 Forbidden. | high |
| A7 | Request an OTP, then submit wrong 6-digit codes repeatedly. | Never returns 200; locks after the attempt cap. | critical |

## B. Broken access control (IDOR / BOLA)

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| B1 | As attacker, pay for a **victim's** confirmed booking (`POST /rentals/bookings/:id/pay`). | 403/404; no charge. | critical |
| B2 | Cancel a victim's booking. | 403/404. | high |
| B3 | As the renter, confirm your own booking as if you were the host (`PATCH …/respond`). | 403/404. | high |
| B4 | Edit another user's profile (`PUT /users/:id`). | 403. | high |
| B5 | Edit another user's vehicle (`PUT /vehicles/:id`). | 403/404. | high |
| B6 | Edit another user's trip (`PUT /trips/:id`). | 403/404. | high |
| B7 | Read a private trip's expenses as a non-member (`GET /trips/:id/expenses`). | 403/404. | high |

## C. Privilege escalation & mass assignment

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| C1 | Send `role: "ADMIN"` while updating your own profile. | Field ignored; role stays USER. | critical |
| C2 | Send `isVerified: true` while updating your own vehicle. | Ignored; vehicle stays unverified. **(was vulnerable — see Findings)** | high |
| C3 | Send `ownerId: <victim>` while updating your own vehicle. | Ignored; ownership unchanged. **(was vulnerable — see Findings)** | high |
| C4 | Call an admin endpoint (`GET /admin/stats`) as a normal user. | 403. | critical |

## D. Injection & XSS

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| D1 | SQL injection via trip search: `' OR '1'='1'; DROP TABLE users;--`. | Treated as a literal string (Prisma parameterises); no error; `users` table still present. | critical |
| D2 | Operator/object injection: send `contact` as `{ "not": "" }` to the OTP endpoint. | Clean 4xx, not a 500 or a DB operator-injection. **(was a 500 — see Findings)** | low |
| D3 | Store `<script>…</script>` as a trip title, then fetch the share preview (crawler user-agent). | Title is HTML-escaped; no raw `<script>` in the page. | high |

## E. Payment integrity

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| E1 | Pay a booking passing `expectedAmount: 1` to try to underpay. | Rejected; the server prices the booking itself. | critical |
| E2 | Verify a **victim's** pending top-up order (`POST /wallet/topup/verify`). | 403/404. | high |
| E3 | POST a **forged** Cashfree "payment success" webhook for a pending order, with no real payment. | Wallet balance unchanged (server re-checks with the provider). | critical |
| E4 | Top up a negative amount. | Rejected (4xx). | high |
| E5 | Withdraw far more than the wallet balance. | Rejected. | critical |

## F. Transport, headers & rate limiting

| ID | Attack | Expected secure result | Severity |
|----|--------|------------------------|----------|
| F1 | Inspect response headers. | Security headers present (helmet: `X-Content-Type-Options`, etc.). | medium |
| F2 | Send `Origin: https://evil.example.com`. | `Access-Control-Allow-Origin` does **not** reflect the unknown origin. | medium |
| F3 | Request a private RC/KYC upload (`/uploads/rc/<file>`). | 404 — identity documents are never served publicly. | high |
| F4 | POST an oversized (>10 MB) JSON body. | Rejected (413/400). | low |
| F5 | Burst the auth endpoint. | Starts returning 429 (rate limited). | medium |

---

## Findings (discovered by this suite, fixed)

### 1. Mass assignment on vehicle update — **High** (fixed)

`PUT /api/vehicles/:id` wrote the request body straight to the database
(`data: req.body`). A vehicle owner could therefore:

- set `isVerified: true` and mark their own vehicle as **verified without any
  admin review**, defeating the vehicle-verification trust signal; and
- set `ownerId` to **reassign the vehicle to another account**.

Both were confirmed end-to-end (HTTP 200 + database change). **Fix:**
`updateVehicle` now whitelists only owner-editable fields (`make`, `model`,
`year`, `type`, `seats`, `fuelType`, `transmission`, `images`) with validation;
`ownerId`, `isVerified`, `rcUrl` and timestamps can no longer be set by the
client. Covered by C2 and C3.

### 2. Unhandled non-string `contact` — **Low** (fixed)

Sending `contact` as an object to `POST /api/auth/request-otp` threw inside
`normalizeContact` (`contact.trim is not a function`) and returned a 500 instead
of a clean validation error. No injection reached the database, but a 500 is
poor input hygiene. **Fix:** `normalizeContact` now rejects non-string input
with a 400. Covered by D2.

---

## Notes on what was already secure

- **JWT**: `alg=none`, wrong-secret, and expired tokens are all rejected; the
  user id comes from the verified `sub` claim, not the request body.
- **SQL injection**: all queries go through Prisma; the two raw queries use
  tagged-template parameters, so the classic payloads are inert.
- **Payments**: booking prices and discounts are computed server-side; the
  provider webhook re-confirms the order with Cashfree before crediting, so a
  forged webhook does nothing.
- **Access control**: ownership/membership is checked on bookings, trips,
  vehicles, profiles, and trip expenses before any read or write.
- **Admin**: every admin route sits behind `authenticate` + `authorize('ADMIN')`
  and (in production) a two-factor session.
