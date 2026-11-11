# Validation record

Executed on November 10, 2026, on macOS with Node 26.7.0, npm 11.19.0, and Docker Engine 29.7.2. Results below describe checks that actually ran, not intended future coverage.

## Scope and acceptance

The delivered starter includes a local NestJS application, separate development/test PostgreSQL containers, pinned dependencies, strict TypeScript, explicit Diplomat boundaries, and a small reservation reference feature. English is used throughout code and documentation. Public deployment, authentication, vehicle inventory, payments, and messaging are outside this reference scope.

## Executed evidence

| Criterion                        | Initial behavioral failure                                                                                                                | Passing evidence                                                                                                                 | Counterfactual / integration evidence                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness and database readiness  | Both original health tests failed with 404 against an empty application module.                                                           | Health HTTP suite passes, including 503 readiness and 200 liveness when the database is unreachable.                             | Temporarily changing the health route prefix made all four final health tests fail; restoring it returned them to green. Readiness uses a real database query.                          |
| Create/read and public contracts | Reservation HTTP tests failed with missing routes, wrong status codes, and missing response contracts.                                    | Creation, retrieval, malformed IDs, invalid input, unexpected fields, and missing entities pass through real Nest HTTP handlers. | Temporarily changing the reservation route prefix made all eight reservation HTTP tests fail; restoring it returned them to green.                                                      |
| Atomic vehicle exclusivity       | The concurrent HTTP test initially received only 404 responses; after first implementation it exposed incorrect 500 conflict translation. | Six simultaneous HTTP creates yield exactly one 201 and five 409 responses, with one active row persisted.                       | PostgreSQL partial unique index is exercised through real connections. Integration tests verify the known conflict is translated and unrelated unique violations are not misclassified. |
| Cancellation and release         | Cancellation HTTP behavior was absent.                                                                                                    | Cancellation preserves its timestamp when repeated and permits another active reservation for the same vehicle.                  | Integration tests race two cancellation writes and verify one stable persisted timestamp. Pure-rule tests verify immutability and idempotency.                                          |
| Domain isolation                 | Supporting architectural evidence, not a feature RED.                                                                                     | Dependency Cruiser reports no violations across 36 modules and 82 dependencies.                                                  | Temporarily importing NestJS into CreateReservation triggers the core-is-framework-and-io-independent rule; the import was removed and checks pass.                                     |
| Test data isolation              | Supporting safety evidence, not a feature RED.                                                                                            | Four target-safety cases reject development, remote, wrong-schema, and non-test environments.                                    | All database suites run against the dedicated loopback interview_test database on port 55433.                                                                                           |
| Reproducible setup               | Initial Jest discovery, server generic typing, and CommonJS/ESM setup failures were resolved before recording behavioral RED.             | A clean npm ci succeeds, including Prisma generation. Development and test migrations apply successfully.                        | The compiled application starts and handles real TCP HTTP requests.                                                                                                                     |

`npm run verify` completed successfully after the counterfactual edits were restored and after the clean install:

- Prettier check: pass.
- Typed ESLint, zero warnings: pass.
- TypeScript strict checks: pass.
- Architecture dependency checks: pass.
- Unit tests: **16 passing** across four suites.
- PostgreSQL integration tests: **7 passing** across two suites.
- HTTP end-to-end tests: **12 passing** across two suites.
- Total: **35 passing tests**, eight suites.
- Prisma generation and Nest production build: pass.

The compiled application was started against the test database on loopback port 3101. A separate HTTP client verified liveness 200, readiness 200, create 201, duplicate conflict 409, fetch 200, cancel 200, and identical responses on repeated cancellation. The smoke-test process was stopped afterward. No development records were created by this check.

Unit/mapping/configuration tests supplement the HTTP behavioral RED and real database integration evidence. They are not presented as independent RED-first slices. The temporary route and forbidden-import mutations were restored; no counterfactual changes remain.

## Known tooling limitations

- Jest's ESM integration uses Node's experimental VM-module flag. The Node warning is expected; production application startup does not use that flag.
- `npm audit --omit=dev --audit-level=low` reports **zero production dependency vulnerabilities** at verification time.
- The complete audit reports **29 development-toolchain findings: four low and 25 moderate**, including transitive glob/minimatch/deepmerge dependencies. No high or critical findings were reported. Some suggested fixes downgrade major test/lint tooling; no forced downgrade or speculative major transitive override was applied. Recheck upstream patches before adopting this starter for a production CI environment.
- npm reports that three third-party install scripts are not yet in its approval list. Prisma generation, clean installation, tests, and builds were verified successfully in this environment. Do not approve unrelated install scripts automatically.
- The local code graph was generated with `graphify update .` as requested by the parent workspace instructions. It is ignored by Git and is not a substitute for executable architecture checks.

## Design decisions

- Consumer-owned storage/runtime ports isolate core policy; Nest factories wire concrete implementations.
- HTTP and persistence adapters implement pure representation translation. Typed request validation and exact HTTP response assertions protect boundary behavior.
- One PostgreSQL partial unique index is sufficient for the single-database concurrency invariant. Distributed locks, sagas, event sourcing, message brokers, and retry policies are not triggered by this example.
- No generic repository superclass, application framework wrapper, or speculative provider integrations were introduced.
- GoF-style adaptation is used at actual external representation boundaries. Additional patterns are not justified by the current scope.
