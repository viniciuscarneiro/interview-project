# Vehicle auction API contract and milestones

This document defines the implementation target. All six milestones are complete: health, authentication, roles, local demo provisioning, auction creation/activation, bidding, highest-bid listing, and deadline-based winner selection are implemented. The complete flow is also verified against the running local development API.

## Scope and decisions

- Keep Node.js, TypeScript, NestJS, Prisma, PostgreSQL, and the feature-oriented Diplomat architecture.
- Use separate auth and auctions capabilities, with bids owned by auctions. Vehicle data is embedded in each auction; there is no inventory service.
- Admin users create and activate auctions. Basic users bid. Both roles can list all auctions, including drafts and ended auctions. Roles are exclusive for this scope: Admin users cannot bid.
- Use email/password login and expiring bearer tokens. Provision local demo accounts for both profiles. Public registration, role management, refresh tokens, and password recovery are outside the initial scope.
- Store password hashes, never plaintext passwords. Credentials and tokens must not appear in logs or public user data.
- Prices are positive, safe-integer **EUR cents**, as confirmed for milestone three. One currency applies to the entire application: `10000` means EUR 100.00. Persist `EUR` with every auction; clients cannot override it. No currency conversion is implemented.
- Accept equal highest bids; lower bids are rejected. This interprets "the earliest highest bid wins" as an observable tie-breaking rule.
- Time and identity come from the server. Wire dates are ISO 8601 strings with an explicit timezone, normalized to UTC in responses. Internal dates are `Date` values.
- Payment, auction editing/deletion, bid withdrawal, notifications, scheduled jobs, and production deployment are outside scope.

## Lifecycle and bidding

1. Creation produces a draft with an end time strictly in the future.
2. Activation changes a draft to active only while `now < endTime`. Repeating activation of an active, unexpired auction succeeds without changing the original activation time. Activation at or after the deadline fails, including for an already-active auction.
3. Bidding requires an active auction and `now < endTime`. Reject at the exact deadline as well as after it.
4. A bid must be at least the starting price and at least the current highest amount. Equal amounts are accepted and do not displace the earlier leader.
5. Serialize bid acceptance for each auction in a database transaction. Obtain the authoritative current time and evaluate eligibility after acquiring the lock, then persist the accepted bid in that transaction. The acceptance instant is this locked eligibility decision, not request arrival or transaction start. A request queued until after the deadline is rejected; a bid accepted just before the deadline can commit afterward.
6. Assign a durable per-auction acceptance order under the same lock. Rank bids by amount descending, then acceptance order ascending. Timestamp ties must not depend on random UUID ordering.
7. At the deadline, the leading bid becomes the final winner. No bids means no winner. Listing derives `ended` from time; no scheduled status update is required. An expired draft also displays as ended and cannot be activated.
8. A transaction failure leaves no accepted bid. Do not blindly retry bid writes. Request idempotency keys are outside the initial scope; repeated successful submissions create distinct bids.

## REST contracts and delivery status

All REST operations below are implemented. Stored auctions may be draft or active; listing derives `ended` at the deadline. `highestBid` is null until a bid is accepted. `winner` is null before the deadline or when no bids exist; afterward it is the earliest accepted highest bid in the committed snapshot.

All request objects reject unknown properties. IDs are UUIDs. Missing or invalid authentication returns 401; an authenticated but disallowed role returns 403. Health endpoints remain unauthenticated.

| Method | Path                     | Access         | Success                            |
| ------ | ------------------------ | -------------- | ---------------------------------- |
| POST   | `/auth/login`            | Anonymous      | 200, token and public user profile |
| POST   | `/auctions`              | Admin          | 201, auction representation        |
| POST   | `/auctions/:id/activate` | Admin          | 200, auction representation        |
| GET    | `/auctions`              | Admin or Basic | 200, paginated auctions            |
| POST   | `/auctions/:id/bids`     | Basic          | 201, accepted bid representation   |

### Authentication

Login input: `{ "email": "buyer@example.test", "password": "..." }`.

Login output: `{ "accessToken": "...", "tokenType": "Bearer", "expiresIn": 3600, "user": { "id": "<uuid>", "email": "buyer@example.test", "role": "BASIC" } }`.

Use a one-hour token lifetime initially; `expiresIn` is in seconds. Unknown email and wrong password produce the same generic 401 response. Role values are `ADMIN` and `BASIC`. Token signing configuration is validated at startup. See README for local provisioning and authentication details. Roles are fixed in a token until its one-hour expiry; revocation and refresh are outside scope.

### Create and activate

Create input:

```json
{
  "vehicle": { "brand": "Volkswagen", "model": "Golf", "vin": "WVWZZZ1KZ6W000001" },
  "startingPrice": 1000000,
  "endTime": "2027-01-01T12:00:00.000Z"
}
```

Trim brand/model and require 1–100 characters each. Normalize VIN to uppercase and require 17 ASCII letters/digits, excluding I, O, and Q. No VIN check-digit algorithm or uniqueness policy is required: separate auctions may reference the same vehicle. Reject non-integer, non-positive, and unsafe money values. End time must include an explicit timezone and be a valid future instant. Accept seconds with zero to three fractional digits and either `Z` or a `+HH:MM`/`-HH:MM` offset; normalize output to UTC milliseconds without silently truncating higher precision.

Activation accepts an omitted body or an empty JSON object; nonempty objects and arrays are rejected. The route ID is validated as a UUID and adapted into an internal reference. Clients cannot set status, timestamps, creator, or identifiers. The operation locks the auction row in a transaction, then reads the server clock and applies the pure transition rule. The acceptance instant is the locked decision, not request arrival; a request waiting until the deadline is rejected. An eligible activation may commit after its decision instant. Repeated and concurrent activations preserve the first activation timestamp.

The auction representation contains exactly:

- `id`, `vehicle: { brand, model, vin }`, `startingPrice`, `currency`, `endTime`.
- `status`: `draft`, `active`, or derived `ended`.
- `createdAt`, `activatedAt` (null until activation).
- `highestBid`: a bid representation or null.
- `winner`: the winning bid representation after the deadline, otherwise null.

`currency` is the agreed application-wide code `EUR`. Responses must not include user email, password hash, ORM metadata, or internal ordering fields.

### Listing

`GET /auctions?limit=20&offset=0` uses a default limit of 20, permits 1–100, and accepts a nonnegative safe-integer offset. Reject invalid or unknown query parameters. Order by creation time descending, then ID ascending. Return `{ "items": [...], "limit": 20, "offset": 0 }`; no total-count query is required. Read each auction's leader and winner consistently from one snapshot and one explicit observation time. Offset pagination does not promise a stable snapshot across multiple requests while auctions are being added.

### Bidding

Bid input: `{ "amount": 1100000 }`. Buyer identity is derived from authentication, never accepted in the body.

A bid representation contains exactly `id`, `auctionId`, `buyerId`, `amount`, and `acceptedAt`. A successful equal bid is returned even though it does not become the leader. Listing reveals the current highest bid and eventual winner. Both amounts and persisted acceptance orders use PostgreSQL BIGINT; only safe-integer amounts are converted to JSON numbers, and the internal order is never exposed. The activation and bid operations share the same row lock. Auction pages and leading bids are read in one repeatable-read snapshot; the winner is derived from that same leader and one explicit observation time.

### Errors

Domain/application failures use `{ "statusCode": 409, "code": "AUCTION_ENDED", "message": "Auction has ended." }` with a stable code and English message.

| Condition                                       | HTTP | Code                 |
| ----------------------------------------------- | ---- | -------------------- |
| Valid authentication but wrong role             | 403  | `FORBIDDEN`          |
| Invalid login or missing/invalid/expired token  | 401  | `UNAUTHORIZED`       |
| Auction does not exist                          | 404  | `AUCTION_NOT_FOUND`  |
| Creation end time is not in the future          | 400  | `INVALID_END_TIME`   |
| Activation or bidding at/after the deadline     | 409  | `AUCTION_ENDED`      |
| Bidding on an unexpired draft                   | 409  | `AUCTION_NOT_ACTIVE` |
| Bid below starting price or current highest bid | 409  | `BID_TOO_LOW`        |

Structural validation failures use the shared Nest ValidationPipe's 400 response (`statusCode`, `message` array, `error`). Unexpected failures remain a generic 500 without database or credential details. Check auction existence, then deadline, then lifecycle, then bid amount so overlapping invalid conditions have predictable results.

## Milestones and small tasks

### 1. Remove the sample and establish contracts

- [x] Record lifecycle, role, REST, error, and concurrency contracts.
- [x] Remove reservation source, routes, and sample-specific behavior tests.
- [x] Add a forward migration removing only the sample table and enum; keep historical migrations unchanged.
- [x] Remove sample row cleanup while retaining dedicated test-target validation.
- [x] Update README and engineering guidance; preserve health and database lifecycle.
- [x] Verify the runnable foundation and record executed evidence in `docs/validation.md`.

### 2. Authentication and roles

- [x] Add users and a forward migration.
- [x] Implement password hashing, login, and expiring bearer tokens.
- [x] Add authentication/role guards and trusted identity-to-actor mapping.
- [x] Add repeatable local demo-account provisioning.
- [x] Test login failures, expiration, authentication, and permissions.

### 3. Create and list drafts

- [x] Confirm EUR with the user before implementation.
- [x] Add auction persistence and create/list internal models and ports.
- [x] Implement Admin creation with validation and explicit mapping.
- [x] Implement authenticated listing with bounded pagination.
- [x] Prove HTTP contracts and a focused real-persistence path.

### 4. Activate auctions

- [x] Implement atomic draft-to-active transition and repeat semantics.
- [x] Add the Admin HTTP endpoint and error mapping.
- [x] Test missing auctions, deadline boundaries, roles, and concurrent activation.

### 5. Bid and determine winners

- [x] Add bid persistence and durable acceptance ordering.
- [x] Establish the missing bidding HTTP behavior with failing tests, then implement and verify pure bidding rules with deterministic tests.
- [x] Implement the transaction/locking port and Basic HTTP endpoint.
- [x] Extend listing with the leader, ended state, and winner.
- [x] Prove deadline and tie behavior, including real PostgreSQL contention.

### 6. Interview delivery

- [x] Exercise login → create → activate → bid → list result.
- [x] Finish runnable examples and document trade-offs.
- [x] Run full verification and record current evidence.

## Architecture and verification

Follow `AGENTS.md`: HTTP diplomats adapt wire data and trusted identity to internal models, call use cases, and explicitly map results back to wire. Use cases own orchestration and consumer-owned effect ports; pure rules have no I/O. Database diplomats implement transactions without taking ownership of business policy. Document the locking, time, atomicity, and failure contract before implementing the bid port.

Use fast pure-rule and isolated HTTP tests for most behavior. Add selected real database scenarios only where doubles cannot establish the guarantee, particularly serialized bidding and deadline re-evaluation after lock waits. Tests must use loopback `interview_test` on port 55433 with `NODE_ENV=test`, run serially, and never fall back to development. Run `npm run verify` before handing off executable changes.

## Targeted coverage audit

The following previously unverified scenarios now have deterministic PostgreSQL E2E evidence:

- [x] Concurrent auctions keep independent acceptance orders, leading bids, winners, and paginated representations.
- [x] A bid racing with an uncommitted activation waits for its row lock and sees the committed active state.
- [x] A bid committed between the two listing queries is excluded from that listing snapshot and appears in the following request.

Pure lifecycle rules have their own colocated suite, separate from the pure bidding suite. Run both with `npm run test:logic`. These specific gaps are closed; this is not a claim to cover every possible operational or out-of-scope scenario.
