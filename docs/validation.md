# Current validation

Verified on November 11, 2026, with Node 26.7.0. All six delivery milestones are complete.

## Running development application

The API is running at `http://127.0.0.1:3100` against the dedicated local development database, `interview_dev` on port 55432. All six migrations were already applied when inspected. The missing demo users were provisioned and the server was restarted with the current compiled application.

- `GET /health/live` and `GET /health/ready`: 200.
- Admin and Basic login: 200 using the passwords configured in the local `.env`.
- Admin create/activate: 201/200.
- Basic bidding: 201; equal highest bids preserve the earlier leader.
- Lower bids: 409; Admin bidding: 403.
- After a real deadline, further bidding returns 409 and listing identifies the earliest highest bid as winner.

Two demonstration auctions remain intentionally available:

| Auction                                | State                                                  | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `a471ceb8-a508-4d8e-a77f-7c7a4d4ee420` | Active at verification, ending 24 hours after creation | Manual bidding; starting price EUR 15,000 (`1500000` cents). |
| `0167d037-5985-45d3-9f9b-e82f93be057d` | Ended                                                  | Verified equal-bid winner behavior; two accepted bids.       |

The server PID and logs are in ignored `.local/api.pid` and `.local/api.log`. Credentials and tokens were not printed. Postman environment templates intentionally do not contain the actual local passwords; copy those values privately from `.env` when using Postman.

## Test review

The suite contains **119 cases**, including **17 pure business-rule tests** and **11 focused adapter cases**. The earlier review removed historical/duplicate coverage; the follow-up closed three specific gaps while removing eight more redundant cases. That review kept 113 cases by replacing repetition with targeted coverage. The adapter cleanup added four cases for explicit user field selection and invalid bid representations. The final isolation review added two pure identity-policy cases; existing HTTP/E2E tests protect the orchestration refactor.

- Removed the two historical sample-retirement suites; the reservation feature is already deleted.
- Removed repeated complete lifecycle checks from the fast HTTP suite when the PostgreSQL scenario already proves the same guarantee.
- Retained one focused successful HTTP bid response contract.
- Reduced repeated invalid-payload examples exercising the same validation behavior.
- Added a colocated pure auction lifecycle suite for creation, activation, idempotency, immutability, deadline boundaries, and winner timing. Moved the winner assertion out of the bid suite into its owning auction-rule suite. Both suites call plain functions with explicit data/time; no Nest, mocks, database, or network.
- Removed repeated numeric-validation examples from HTTP tests now protected directly by pure rules, repeated configuration values in the same rejection class, a duplicate healthy-liveness test, and the unused bid-ranking implementation in the HTTP fake. Kept role/token checks, structural HTTP validation, persistence mappings, and dedicated database-target safety checks.
- Kept real concurrency tests: one activation timestamp, serialized equal bids, deterministic tie order, and deadline/highest-amount rechecks after observed row-lock waits.

Run `npm run test:logic` for the two pure suites. The coverage review required no production behavior changes; the subsequent architecture cleanup below preserves the same public behavior.

### Previously missing scenarios now verified

| Scenario                               | Evidence                                                                                                                                                                     | Counterfactual check                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Separate auctions with concurrent bids | `test/e2e/bidding.e2e-spec.ts`: independent per-auction orders, different leaders, correct winners, and scoped pagination.                                                   | Returning the first auction's leader for every row makes the test fail.          |
| Activation racing with a bid           | The test pauses the real activation update before commit, observes the bid waiting on the database row lock, then checks active state and one accepted bid after commit.     | Removing `FOR UPDATE` makes the required lock wait disappear and the test fail.  |
| Listing while a higher bid commits     | The first real page query completes, a higher bid commits through HTTP, and the page's second query still returns its original leader; the next request sees the higher bid. | Changing `RepeatableRead` to `ReadCommitted` mixes snapshots and fails the test. |

The scheduling gates use Prisma query extensions only in the test application. They execute the real queries, pause at explicit synchronization points, and return unchanged results. Actual PostgreSQL transactions, commits, locks, controllers, and use cases remain enabled. The tests therefore protect our transaction placement and read consistency rather than substituting a database fake.

Pure-rule counterfactuals also failed when creator identity, repeat activation timestamps, or exact-deadline winner timing were deliberately broken. All mutations were restored before final verification.

The test count includes individual rows in parameterized tests; it is not a count of separate test files.

## Architecture and redundancy cleanup

- Moved health HTTP handling into `diplomat/http`. Readiness now goes through `CheckReadiness`, its `DatabaseProbe` port, the Prisma diplomat, and an explicit response adapter. No SQL or Prisma imports remain in controllers. Existing health E2E checks cover the refactor; no one-test-per-class suites were added.
- Broadened the HTTP persistence rule to cover every feature `*.controller.ts`, including legacy paths. The tightened rule initially failed on the old health import and passes after the correction. This closes a checker blind spot rather than weakening a boundary.
- Added explicit `toUserRecord` mapping to provisioning. Its test first demonstrated that spreading an internal user leaked an extra field into the vendor input; the explicit mapping excludes it.
- Consolidated three repeated auction-controller error handlers in one feature-owned HTTP filter. Existing contract tests protect status codes, stable errors, and generic unexpected failures.
- Removed the second email/vehicle normalization pass from HTTP adapters. DTO transforms still canonicalize values before validation; adapters still construct independent internal models explicitly.
- Added only three bid-adapter rejection cases (nonpositive amount, unsafe amount, and invalid acceptance order), with valid round trips already covered by real persistence scenarios.
- Kept separate consumer-owned ports and explicit request/result mappings. They enforce ownership and dependency direction; combining them only because their fields look alike would remove useful boundaries.

`npm run test:adapters` passed all 11 cases in three suites. Counterfactual checks failed when user mapping was changed back to a spread, bid guards were removed, or the centralized not-found status was changed to 400. All mutations were restored before final verification.

The compiled local API was restarted after the refactor. Liveness/readiness, normalized Admin/Basic login, authenticated listing, and both activation/bid not-found contracts were verified against the running application. No development records were changed.

## Final Diplomat isolation review

The following remaining boundaries were isolated while preserving the REST contracts:

- Authentication guards parse HTTP headers and invoke `Authenticate` through an explicit input adapter. Token verification and time ports are consumed by the framework-independent use case, not by the HTTP diplomat.
- Demo-account identity decisions live in pure `auth/logic`. The provisioning use case passes that decision into the transaction port. The database implementation only performs the upsert, maps the stored record, and invokes the callback before committing.
- The provisioning script is bootstrap only: configuration validation, application lifecycle, and CLI output. It calls the exported typed `DemoAccountsCli`, which adapts its wire request into internal commands before invoking the use case.
- Auction persistence status mapping is exhaustive and rejects unsupported states instead of defaulting them to ACTIVE.
- Every use-case signature and HTTP/CLI input/output mapping was inspected. No DTO, HTTP request, JWT claim object, Prisma record, configuration, or concrete effect implementation enters the core.

Dependency Cruiser now generates positive per-feature layer allowlists, including type-only imports. Models, logic, use cases, ports, wire, adapters, inbound diplomats, outbound diplomats, configuration, and infrastructure have explicit import boundaries. The only intentionally shared feature contracts are auth identity types and HTTP route decorators.

ESLint additionally rejects ambient effects in core/mappings, environment access outside configuration, unclassified feature files, casts replacing adaptation, production imports of tests, runtime Prisma imports in adapters, direct outbound IO in HTTP/CLI, and dynamic feature imports. The rules are complementary: dependency checks do not claim to prove every structurally compatible data flow; actual adapter calls were reviewed as well.

Temporary negative probes proved rejection of:

1. Core imports of composition modules.
2. Adapter imports of use-case types.
3. Database imports of business policy.
4. Wire aliases of internal models.
5. Feature dependencies inside infrastructure.
6. Ambient Date/random/process effects in pure layers.
7. Misplaced feature implementation files.
8. Casts bypassing representation boundaries.
9. Runtime ORM clients inside adapters.
10. Outbound network access directly inside HTTP.
11. Production imports of test code.
12. Dynamic runtime-client imports.

All probes were removed. A counterfactual that skipped the core identity callback also failed the existing real-database rollback E2E, demonstrating that the extracted policy is actually invoked. The typed CLI path is exercised by the existing provisioning/login E2E and by the actual `auth:seed -- --test` command.

After the build, the development API was restarted and checked for public health, normalized Admin/Basic login, authenticated listing, and invalid-token rejection. No development records or schema were changed during this isolation review.

## Executed verification

`npm run verify` passed after the test review:

| Check                                  | Result                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| Prettier, typed ESLint, TypeScript     | Pass; zero lint warnings                                  |
| Architecture boundaries                | Pass; 98 modules, 264 dependencies                        |
| Fast tests                             | 101 passing in ten suites; no PostgreSQL access           |
| Integration/end-to-end tests           | 18 passing in six suites (14 E2E plus four safety checks) |
| Total                                  | 119 passing in sixteen suites                             |
| Prisma generation and production build | Pass                                                      |

`npm run test:logic` separately passed all 17 pure cases in three suites. The development API still returned readiness 200 after verification.

Database tests ran serially against `interview_test` on port 55433 with `NODE_ENV=test`. The prior development readback showed two users, two auctions, and two bids. This coverage review used only the dedicated test target and left the running development application unchanged.

## Scope and trade-offs

Prices are integer EUR cents. Bidding and activation share an auction row lock; the server clock is read after acquiring it. Equal bids are ordered by a durable per-auction acceptance number. Auction pages and leading bids share a repeatable-read snapshot; winner timing is pure logic, without a scheduler.

The application remains a local interview API. Public registration, payments, bid withdrawal, refresh/revocation, production deployment, and request idempotency keys are outside scope. Repeating a successful bid request creates another bid. No dependency versions changed or fresh dependency audit was performed during this final setup/review.
