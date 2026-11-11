# Engineering guide

## Purpose and language

This repository is a small, runnable interview starter. All code, comments, documentation, test names, and API messages must be in English. Preserve a working application after every change. Prefer a complete, testable vertical slice over speculative framework code.

The reservations feature is an illustrative reference, not an assumption about the interview assignment. It demonstrates explicit HTTP contracts, pure domain decisions, application orchestration, and real persistence. The application is local development software; it has no authentication or authorization and must not be exposed as a production service.

## Architecture: feature-oriented Diplomat adaptation

Organize business capabilities under `src/modules/<feature>`. A Nest module is the composition root for a feature, not a business layer. This is a TypeScript/NestJS adaptation of Diplomat and ports-and-adapters principles, not a literal copy of a Clojure directory convention.

| Location                  | Owns                                                                                                                                                        | Must not contain                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `model/`                  | Internal domain types, vocabulary, states, and domain errors. Prefer readonly data.                                                                         | NestJS decorators, HTTP statuses, DTOs, ORM types, I/O, environment access.             |
| `logic/`                  | Pure business rules and state transitions. All inputs, including time and identifiers when needed, are explicit.                                            | Database/network/file access, randomness, ambient time, logging, transport translation. |
| `use-cases/`              | Application operations: coordinate ports, call pure rules, return internal results. Own application errors when they describe an operation.                 | NestJS, Prisma, SQL, DTOs, concrete diplomats, adapters, process environment.           |
| `use-cases/ports/`        | Small consumer-owned contracts for effects such as storage or time/ID generation. Document atomicity, errors, and idempotency.                              | Vendor types, HTTP request/response shapes, generic CRUD base interfaces.               |
| `wire/in/`                | Incoming external contracts, e.g. request DTOs with runtime structural validation.                                                                          | Business orchestration, persistence, domain decisions.                                  |
| `wire/out/`               | Explicit outgoing external contracts, e.g. response DTOs with stable JSON shapes.                                                                           | Leaking full ORM records, implicit serialization of internal objects.                   |
| `adapters/`               | Pure translation between external representations and internal models/inputs. HTTP and persistence mappings are separate when their representations differ. | I/O, business policy, invoking use cases or diplomats.                                  |
| `diplomat/http/`          | Nest controllers, routes, HTTP-specific validation/error translation, invoking adapters and use cases.                                                      | Business decisions, direct SQL/Prisma calls, coordinating unrelated integrations.       |
| `diplomat/database/`      | Implement storage ports, execute queries/transactions, translate database failures, invoke persistence adapters.                                            | Owning business policy, returning vendor records to use cases.                          |
| `diplomat/<integration>/` | Other real side-effect boundaries such as external HTTP or messaging, added only when required.                                                             | Speculative clients, swallowed failures, unbounded retries.                             |
| `<feature>.module.ts`     | Register controllers and providers; bind ports to implementations using factories/tokens.                                                                   | Business rules or operations performed during provider registration.                    |
| `<feature>.tokens.ts`     | Runtime injection tokens. TypeScript interfaces do not exist at runtime.                                                                                    | Business behavior.                                                                      |
| `infrastructure/`         | Shared technical resources, e.g. one Prisma client/pool and its shutdown lifecycle.                                                                         | Feature-specific queries or rules.                                                      |
| `config/`                 | Parse and validate environment at the boundary, then expose typed configuration.                                                                            | Logging credentials or scattering `process.env` reads through features.                 |

### Dependency direction

Here `A -> B` means A imports/depends on B, not that data only flows in that direction.

- `logic -> model`.
- `use-cases -> model, logic, own ports`.
- `ports -> internal types`.
- `adapters -> wire, model, internal input types`; persistence adapters may import generated Prisma types and enums solely for representation mapping.
- `diplomat/http -> wire, adapters, use-cases`.
- `diplomat/database -> infrastructure/database, adapters, model, port contracts`.
- Composition modules may import all of their feature's components to wire them together.
- `wire` and `model` do not depend on adapters. A two-way conversion does not imply a two-way code dependency.
- A use case depends on a storage port; the database diplomat implements it. The use case must never import its concrete implementation.
- A runtime Nest module import only exposes exported providers. Export only what another module actually needs; avoid global feature modules and circular module dependencies.

Run `npm run test:architecture`. Update its rules only for a documented architectural decision, never just to silence a forbidden import. Models, pure rules, ports, and use cases must remain framework-independent. Unit tests can sit next to the production files; architecture constraints apply to production imports.

### Contracts, adapters, and model

`wire/in` and `wire/out` describe messages entering/leaving this application. For an external HTTP client, an incoming provider response belongs to wire/in and the outgoing provider request to wire/out. If integrations appear, namespace contracts by protocol/provider to avoid ambiguity.

A DTO is an external contract, not a domain entity. A create request may map to a small internal command; a complete model is built only after the operation has obtained its required data. Keep `wire` independent of internal models so internal refactors do not silently change the public API.

Use explicit response mapping. Preserve field names, units, nullability, enum semantics, and date representations. Dates are `Date` values internally and ISO strings over HTTP. Mappings must reject unsupported representation values rather than silently inventing defaults. Merely separating DTOs does not guarantee compatibility: verify request acceptance, rejection, and exact response shapes in HTTP contract tests.

An adapter can contribute to an anti-corruption boundary when translating another system's semantics. The internal model is what that boundary protects. A trivial field mapping does not automatically require a full ACL service.

Database contracts are represented by the Prisma schema/generated types at the persistence boundary. Do not manually duplicate those types in wire just to populate another directory. Generated Prisma types must not escape into core code or public response contracts.

### NestJS and Node.js practices

- Keep the domain and use cases as ordinary TypeScript. Construct them with `useFactory`; register interface implementations using stable Symbol tokens.
- Share application configuration between production bootstrap and end-to-end tests through `configureApp`.
- Validate incoming DTOs at runtime. Reject unexpected properties and malformed identifiers. TypeScript types alone do not validate JSON.
- Treat HTTP transport validation separately from domain invariants. Translate known domain/application failures at the HTTP boundary; unexpected failures remain generic 500 responses.
- Keep modules cohesive. Models, functions, and DTOs are not Nest modules and do not require providers unless there is an actual runtime dependency to inject.
- Use one managed database pool per application, bounded connection/query timeouts, and shutdown hooks. Do not create clients per request.
- Distinguish liveness (the process can answer) from readiness (dependencies can serve traffic). Do not require a working database to answer liveness.
- Await asynchronous operations. Handle bootstrap failure and promise rejection intentionally. Never run synchronous filesystem or CPU-heavy work on request paths.
- Do not log credentials, request bodies containing personal data, or configuration values. Return sanitized errors.
- Add retries only for a demonstrated transient failure and an operation safe to repeat. Never blindly retry writes.

### TypeScript practices

- Keep `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled.
- Prefer `unknown` plus narrowing at untrusted boundaries. Do not introduce `any`, blanket casts, `@ts-ignore`, or broad lint disables to bypass checks.
- Use type-only imports when appropriate, but preserve runtime imports/tokens needed by decorators and dependency injection.
- Prefer readonly interfaces, discriminated unions, exhaustive state mappings, and small named functions. Use classes for lifecycle/orchestration when they add value.
- Avoid generic base repositories/controllers, inheritance hierarchies, and catch-all `utils` directories. Extract shared code only when shared meaning and change lifecycle are established.
- Pin dependencies and commit the lockfile. Keep Prisma CLI, client, and adapter on the same version. Generated code is ignored and regenerated before build.

## Reference feature contract

- `POST /reservations`: accepts UUID `vehicleId` and `buyerId`; creates an active reservation and returns 201.
- `GET /reservations/:id`: returns the explicitly mapped reservation or 404.
- `DELETE /reservations/:id`: cancels the reservation, returns its representation, and is idempotent for an existing cancelled reservation. Missing IDs return 404.
- At most one active reservation may exist for a vehicle. A PostgreSQL partial unique index enforces this atomically. Concurrent conflicting creates produce one 201 and the others 409. A cancelled reservation releases the vehicle.
- Vehicle/buyer IDs are opaque references in this teaching example: there is no inventory, buyer service, payment, authentication, expiry, or ownership authorization.
- Cancellation updates only an active reservation and preserves the original cancellation timestamp on repeats. Use cases must not pretend an availability pre-check guarantees concurrency safety.

## Testing strategy: protect application behavior

Choose tests by the application guarantee and the failure they would detect. The folder structure is not a requirement to create one test suite per file or repeat the same assertion at every layer. Prefer the smallest test that proves the guarantee. Most feedback should come from fast tests without PostgreSQL, Docker, or network access.

Trust the documented behavior of PostgreSQL, Prisma, NestJS, and validation libraries. Do not write tests whose only purpose is to prove that PostgreSQL implements UNIQUE, that an ORM method exists, or that a framework decorator works. Test our rules, mappings, error handling, configuration, and observable use of those dependencies.

### What and how to test in each layer

| Layer                           | Application guarantees to protect                                                                                                                                         | How to test                                                                                                                                                                                                                          | Avoid                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/`                        | Invariants enforced by actual constructors or value objects, if any.                                                                                                      | Call runtime behavior directly with valid, boundary, and invalid inputs. Use type checking for interfaces and unions.                                                                                                                | Tests for plain interfaces, property declarations, or trivial data containers.                                                                        |
| `logic/`                        | Business decisions, allowed transitions, boundary conditions, immutability, and idempotency where required.                                                               | Call pure functions directly with explicit inputs and compare returned values/errors. Supply fixed time and identifiers. No Nest testing module or mocks.                                                                            | Reimplementing the rule in the expected value or adding tests solely to cover lines.                                                                  |
| `use-cases/`                    | Results and effects of orchestration: success, missing data, known failures, and preventing effects when an operation is rejected.                                        | Instantiate the class directly. Replace only effect ports with small typed fakes or stubs. Keep real logic and adapters out of the fake. Assert returned results, domain errors, and resulting fake state.                           | Mocking the use case itself, asserting every private call, or retesting every pure-rule permutation here.                                             |
| `use-cases/ports/`              | The behavioral contract expected from implementations: absence semantics, errors, atomicity, and repeat behavior.                                                         | Exercise consumers with realistic port outcomes. Test concrete implementations selectively. Reuse behavioral contract cases if multiple maintained implementations must be interchangeable.                                          | Runtime tests of an interface declaration; assuming a fake proves real storage atomicity.                                                             |
| `wire/in/`                      | Accepted/rejected payloads, required/optional fields, supported values, and unknown-field policy.                                                                         | Prefer a focused HTTP contract test through the real ValidationPipe. Use table-driven payloads. Direct validation tests are useful only for custom or complex validation.                                                            | Testing class-validator internals or assuming TypeScript annotations validate incoming JSON.                                                          |
| `wire/out/`                     | Public field names, enum meanings, units, date formats, nullability, and absence of internal fields.                                                                      | Assert explicit response objects in mapping or HTTP tests. Include optional/null values and serialization boundaries. Keep expectations independent of the production mapper.                                                        | Deriving expected output from the same response mapper or importing the internal model as the external contract.                                      |
| `adapters/`                     | Correct representation/semantic translation and handling of unsupported or inconsistent input.                                                                            | Invoke mapping functions with small, realistic fixtures. Check normalization, timestamps, nulls, enum translation, and field leakage where relevant. No I/O.                                                                         | Business-rule tests here, mock-heavy tests, or duplicated tests for identity mappings already protected by a contract test.                           |
| `diplomat/http/`                | Routes, status codes, validation, serialization, error translation, and guards when present.                                                                              | Start a Nest test application with the real HTTP boundary and shared `configureApp`. For fast contracts, replace effect ports; retain real use cases when practical. For selected end-to-end scenarios, retain real persistence too. | Requiring a database just to test an HTTP status/DTO, or mistaking a direct controller call for an HTTP contract test.                                |
| `diplomat/database/`            | Our implementation of the storage port: mapping, query behavior relevant to the feature, absence semantics, known-error classification, and unexpected-error propagation. | Unit-test owned translation/classification using representative vendor fixtures when sufficient. Add a focused real-database scenario only for a specific guarantee that doubles cannot establish.                                   | Tests of database engine internals, exhaustive mocked Prisma call sequences, or a separate real-database test for every repository method by default. |
| `diplomat/<integration>/`       | Our request construction, provider response/error interpretation, and timeout/retry behavior when implemented.                                                            | Use a controlled local stub server or a client-boundary double with realistic provider fixtures. Verify public outcomes and relevant outgoing requests.                                                                              | Live third-party services in routine tests, guessed provider formats, and retry tests when no retry behavior is required.                             |
| Modules and tokens              | Required bindings resolve and real components collaborate.                                                                                                                | Let focused Nest HTTP tests and selected application smoke tests verify composition. Keep architecture checks for forbidden dependencies/cycles.                                                                                     | Testing decorator metadata, token names, or provider arrays merely because they exist.                                                                |
| `config/` and `infrastructure/` | Our environment parsing, safe defaults, secret redaction, cleanup guards, health behavior, and resource lifecycle where failure is material.                              | Test parsing/guards as functions. For health and lifecycle, exercise the actual boundary or a controlled failing dependency.                                                                                                         | Retesting Node's URL parser or Prisma's pool implementation.                                                                                          |

### Using fakes and stubs

- A fake implements a port with simple behavior, such as an in-memory map. A stub supplies a scenario outcome, such as returning null or raising a known conflict. Keep both typed against the application's port.
- Construct use cases with a fixed runtime/clock and deterministic IDs. Do not sleep to make timestamps differ.
- Use real business functions. Do not reproduce production business rules inside a fake; that can make the test pass because both copies contain the same mistake.
- Assert observable outcomes and meaningful effects. For example, when cancellation cannot find a reservation, assert the application error and that no state was changed. Interaction assertions are appropriate when an effect itself is the contract, such as preventing a charge, but avoid pinning unrelated call order.
- An in-memory store proves how the consumer behaves under its simulated outcomes. It cannot demonstrate SQL behavior, database isolation, or race safety across actual connections.

### HTTP contracts versus end-to-end coverage

A contract test is defined by what it verifies, not by whether a real database runs underneath it. HTTP validation, error/status mapping, and response serialization can usually be verified with the storage port replaced and the real Nest boundary enabled.

For an isolated HTTP contract test, use `@nestjs/testing`, configure the app with `configureApp`, and override the relevant effect providers. Ensure no real external access remains. Send requests with Supertest and close the application afterward. Prefer retaining real use cases to prove the boundary passes valid internal inputs to its consumer. A stubbed use case is appropriate for a narrow transport-error scenario; label the narrower scope honestly.

Selected end-to-end tests retain the real application and database to demonstrate a complete feature path. A passing mocked HTTP contract test does not prove real persistence. Do not repeat the complete invalid-payload matrix against PostgreSQL when the isolated HTTP contract suite already proves it.

The current starter's `test/e2e` suite uses real PostgreSQL. This guide does not change those existing tests or commands. New fast unit/HTTP contract tests can be colocated as `*.spec.ts` under `src/`; `npm test` discovers them and must remain database-independent.

### When a real database test is justified

Before adding one, state the specific application guarantee, why a deterministic double is insufficient, and whether an existing feature scenario already covers it. A migration or persistence change may justify one focused compatibility check; that does not imply retesting all database features.

Example from this starter: PostgreSQL correctly rejected a second active reservation, but our Prisma error interpretation initially returned HTTP 500 instead of the intended 409. The useful guarantee is **a known persistence conflict becomes the correct application error and HTTP response**. A classifier unit test with an observed error fixture protects our translation; a selected real integration checks that the actual provider still emits the shape we handle. Neither is a test of PostgreSQL's UNIQUE algorithm.

If concurrent behavior is an acceptance criterion, a focused real-concurrency scenario can prove our complete operation. Do not add a second constraint-only test that duplicates that evidence. If a real integration is omitted, describe the unverified boundary honestly instead of claiming a fake proves it.

### Test quality and placement

- Name tests after behavior: `preserves the first cancellation timestamp`, not `calls updateMany`.
- Cover success, relevant boundaries, and meaningful failures. Do not invent cases solely to meet a coverage percentage.
- Build expected values independently of the code under test. Avoid broad snapshots where explicit assertions make the contract clearer.
- Add a failing behavioral test before implementing new behavior; first distinguish missing behavior from environment/import failures. A useful test should fail when the protected behavior is broken.
- Prefer colocated `*.spec.ts` for pure rules, mappings, use cases, and isolated HTTP contracts. Use `test/integration` for selected real component boundaries and `test/e2e/*.e2e-spec.ts` for full HTTP/application/database scenarios.
- A simple forwarding use case/controller can be sufficiently covered by a feature-level test. Do not manufacture a unit test for every class.
- Run `npm test` for fast local feedback. Run the relevant integration/end-to-end suite when the changed behavior crosses that actual boundary, and the full verification command for executable-change handoff or CI. Describe test scope and skipped checks accurately.

### Safe database use

- Database tests must use the dedicated loopback `interview_test` database on port 55433 and `NODE_ENV=test`. The test runner validates the target before migrations or deletion. Never fall back to the development `DATABASE_URL`.
- Tests run serially because they reset shared reference data. Do not parallelize database suites without adding isolated databases/schemas.
- Never use a broad truncate/drop/reset command. Delete only the known reference table's rows after validating the dedicated test target. Development data must survive tests.
- Never edit an applied migration; add a new migration. Preserve the hand-written partial unique index when changing schema/migrations.

## Commands and completion

Use the Node version in `.nvmrc`. `npm ci` installs locked dependencies. `npm run db:up` starts the two local databases. `npm run db:generate` generates the Prisma client; `npm run db:migrate` applies committed development migrations. Start with `npm run start:dev`.

For executable changes, before handoff run `npm run verify`: formatting, typed ESLint, type checking, architecture boundaries, unit/integration/HTTP tests, and production build. For documentation-only changes, check the changed Markdown's formatting and consistency; application/database test reruns are unnecessary unless executable behavior also changed. Use Prettier on the changed files and preserve unrelated edits. Explain any check that was not executed; never report success based only on reading code.

When adding a feature: state observable contracts; introduce only needed layers; add the first failing HTTP or domain test; implement one complete operation; verify rules, mappings, errors, and relevant effects at the smallest sufficient scope. Add real-persistence evidence only where it establishes a specific application guarantee that other tests cannot. Document how to run the selected checks.

Keep the README and commands accurate. Keep `AGENTS.md` current when a boundary changes. No external integrations or generated artifacts should be introduced without a concrete task need.
