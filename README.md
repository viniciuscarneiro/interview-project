# Interview Project

A runnable NestJS + TypeScript backend starter with PostgreSQL, Prisma, explicit HTTP contracts, and a feature-oriented Diplomat adaptation. The reference reservation feature is an example for learning and practice, not a prediction of the interview assignment.

## Requirements

- Node.js **26.7.0** (`.nvmrc`) and npm 11.
- Docker with the Compose plugin, running locally.
- Free local ports: **3100** (API), **55432** (development PostgreSQL), **55433** (test PostgreSQL).

Dependencies are pinned in `package.json` and `package-lock.json`. Prisma CLI, client, and PostgreSQL adapter use the same stable version. This project uses native ESM (`type: module`, TypeScript `NodeNext`, `.js` specifiers in TypeScript source). Jest currently runs with Node's `--experimental-vm-modules` flag; the resulting Node warning is expected.

## Quick start

```sh
nvm install
nvm use
npm ci
cp .env.example .env
cp .env.test.example .env.test
npm run db:up
npm run db:migrate
npm run start:dev
```

On the originally prepared machine, the local `.env` files and databases are already configured. Copy the examples only for a fresh checkout or when intentionally resetting local settings. Their credentials are disposable local development credentials. Both database ports and the API bind to loopback by default.

The API runs at `http://127.0.0.1:3100`. `npm ci` generates the Prisma client through `postinstall`. `npm run build` also regenerates it before compilation.

```sh
curl http://127.0.0.1:3100/health/live
curl http://127.0.0.1:3100/health/ready
```

Liveness returns `200 {"status":"ok"}` even when the database is unavailable. Readiness executes a real database query and returns 503 with a sanitized response if the dependency is unavailable. Database connections are lazy so that a dependency outage does not prevent the application from serving liveness. Connection/query timeouts are bounded, and the pool closes on application shutdown.

## Reference API

| Method | Path                | Behavior                                                                                                        |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| POST   | `/reservations`     | Create an active reservation; 201 or 409 if the vehicle is already reserved.                                    |
| GET    | `/reservations/:id` | Fetch a reservation; 200 or 404.                                                                                |
| DELETE | `/reservations/:id` | Cancel a reservation; 200 with its representation, or 404. Repeated cancellation preserves the first timestamp. |

```sh
curl -i -X POST http://127.0.0.1:3100/reservations \
  -H 'Content-Type: application/json' \
  -d '{"vehicleId":"11111111-1111-4111-8111-111111111111","buyerId":"22222222-2222-4222-8222-222222222222"}'
```

The response contains exactly `id`, `vehicleId`, `buyerId`, `status`, `createdAt`, and `cancelledAt`. Dates are ISO strings; `cancelledAt` is null while active. IDs must be UUIDs. Unknown request properties are rejected, including caller-supplied IDs, timestamps, and status.

Use the returned reservation ID with GET or DELETE. After cancellation, the vehicle can be reserved again. Vehicle and buyer IDs are opaque references: this starter does not implement vehicle inventory, payments, users, authentication, expiry, or authorization. Keep it local; authentication/authorization must be designed before exposing it to real users.

### Concurrency and failure behavior

A PostgreSQL partial unique index, `reservations_one_active_per_vehicle`, enforces one active reservation per vehicle. An availability read followed by an insert would not be sufficient. The database diplomat translates only this known constraint into `VehicleAlreadyReservedError`; the HTTP boundary maps it to a stable 409 response. Other persistence failures remain unexpected errors.

Cancellation performs a conditional update on the active status. Concurrent or repeated cancellations preserve the first successful timestamp. No multi-service transaction, retry loop, or queue is needed for this example.

The migration also enforces consistency between status and the cancellation timestamp. The partial unique index is maintained explicitly in SQL; inspect generated migrations and preserve it when changing the Prisma schema. Never edit a migration that has already been applied.

## Architecture

Read [AGENTS.md](AGENTS.md) before changing the project. It defines allowed dependencies, layer responsibilities, contract rules, and TypeScript/NestJS practices.

```text
src/
  config/                         Environment boundary and typed configuration
  infrastructure/database/        Shared Prisma client and connection lifecycle
  modules/
    health/                       Process/dependency health endpoints
    reservations/
      model/                      Internal types and domain errors
      logic/                      Pure state-transition rules
      use-cases/                  Operations and orchestration
        ports/                    Consumer-owned effect contracts
      wire/in/                    Incoming HTTP contracts
      wire/out/                   Outgoing HTTP contracts
      adapters/                   Pure representation translation
      diplomat/http/              Nest controllers and HTTP error mapping
      diplomat/database/          Prisma implementation of the storage port
      reservations.module.ts      Dependency composition
      reservations.tokens.ts      Runtime injection tokens
```

The HTTP diplomat validates wire input, maps it to an internal command, calls the use case, and maps the internal result to wire output. The use case calls the storage port and pure logic as needed. The concrete database diplomat implements that port. `Model` and `Wire` define data; they are not execution stages.

Framework-independent use cases are instantiated through Nest factories. Pure logic and type declarations do not need Nest providers. The example module exports no providers because no other capability needs them. DatabaseModule explicitly exports the shared client to consuming modules.

## Verification

Start the databases first, then run:

```sh
npm run verify
```

This executes formatting, typed ESLint, TypeScript checks, architecture dependency checks, unit tests, real database integration tests, HTTP end-to-end tests, and a production build.

| Command                                        | Purpose                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm test`                                     | Fast unit tests; no database required.                                                |
| `npm run test:integration`                     | PostgreSQL persistence and test-target safety checks.                                 |
| `npm run test:e2e`                             | HTTP contracts, invalid input, conflict handling, cancellation, and health.           |
| `npm run test:all`                             | Unit, integration, and HTTP suites.                                                   |
| `npm run test:architecture`                    | Reject core/framework coupling, unsafe layer imports, unresolved imports, and cycles. |
| `npm run format`                               | Apply formatting.                                                                     |
| `npm run lint`                                 | Typed linting, including unsafe values and floating promises.                         |
| `npm run typecheck`                            | Strict TypeScript checks, including tests.                                            |
| `npm run build`                                | Generate the client and compile the application.                                      |
| `npm start`                                    | Run the compiled application.                                                         |
| `npm run db:migrate:dev -- --name your_change` | Create/apply a new development migration.                                             |
| `npm run db:down`                              | Stop this project's database containers without deleting development data.            |

### Database isolation

Development uses `interview_dev` on port 55432 with a named volume. Tests use `interview_test` on port 55433 in a separate container with ephemeral storage. Test commands load `.env.test`, verify the exact loopback target, apply committed migrations, and run serially. Cleanup validates the target again before deleting only the reference reservation rows. Test code never falls back to the development URL.

Do not use `docker compose down -v` unless you explicitly intend to delete development data. Stopping/recreating the test container may erase its data; the test runner reapplies migrations automatically.

## Evolving the starter during the interview

1. Confirm observable behavior, input/output contracts, and important failure cases.
2. Add a failing test for the first complete operation.
3. Define the internal vocabulary and narrow ports required by that operation.
4. Implement pure rules, boundary mappings, side effects, and Nest wiring.
5. Verify the real HTTP/database path and the relevant concurrency/error cases.
6. Run the checks and explain any remaining trade-offs.

Keep features cohesive and avoid generic base controllers/repositories. Add HTTP clients or messaging only when the assignment requires them. To work on a different domain, add a new feature module and remove `ReservationsModule` from `AppModule` when the reference routes are no longer useful; update tests and migrations deliberately.

See [docs/validation.md](docs/validation.md) for the setup's executed evidence and known tooling limitations.
