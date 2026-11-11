# Postman import

For the complete setup and import walkthrough, see [Run the API with Postman](../../README.md#run-the-api-with-postman).

Import both files into Postman:

- `vehicle-auction.postman_collection.json` — thirteen requests covering the seven current route definitions.
- `local.postman_environment.json` — local API URL, credentials, tokens, pagination, and auction variables.

Select **Vehicle Auction — Local** as the active environment. Set `admin_password` and `buyer_password` to the passwords already provisioned for `admin@example.test` and `buyer@example.test`. For the local demo command these originate from `DEMO_ADMIN_PASSWORD` and `DEMO_BUYER_PASSWORD` in your local `.env`. Repeat provisioning preserves existing passwords; changing an environment variable does not reset an account.

The API must already be running with its applicable migrations and demo accounts. Follow the repository README for setup. These import files do not apply migrations, start services, or create users. No local credentials or existing tokens were copied into them.

## Request order

1. Check liveness and readiness.
2. Run both login requests. Each stores its own token in the selected environment. Login payloads are serialized as JSON by the pre-request script, so passwords containing quotes or backslashes remain valid.
3. Create a draft as Admin. This captures `auction_id` and clears the previous activation timestamp. `1000000` represents EUR 10,000.00.
4. List auctions using either profile. Adjust `limit` (1–100) and `offset` (nonnegative safe integer).
5. Run Activate, then Repeat activation. The second request checks that the first activation timestamp is preserved.
6. Run folder 05: place a bid as Basic, place an equal bid, check the earliest highest bid, and verify rejection of a lower bid. Use a fresh auction without competing submissions for this scenario.

Leave `auction_end_time` blank to generate a deadline 24 hours ahead for each create request. To test a specific deadline, set it to an ISO timestamp with an explicit timezone, for example `2027-01-01T12:00:00.000Z`. That value must still be in the future. You can set `auction_id` manually to operate on an existing auction.

Running Create again adds another auction. Activation changes a draft to active. Each accepted bid is also a new record, including equal bids. The API has no auction deletion endpoint, and the collection performs no cleanup.

## Delivery status

Milestones one through five are complete. Health, login, creation, listing, activation, bidding, highest bids, and winner selection are available. Run all five folders in order with the current migrations applied. Folder 05 uses `bid_amount` (default `1100000` EUR cents) and captures the first and last bid IDs. Equal bids are accepted; the earliest equal-highest bid remains the leader. The lower-bid check expects `409 BID_TOO_LOW` before the deadline. Admin users cannot place bids.

Run **Check earliest highest bid and winner** again after the deadline to check the winner. It expects `winner: null` while active, and the first bid as winner once ended. The collection neither waits for the deadline nor modifies server time. The check searches the newest 100 auctions; use regular pagination if your selected auction has moved beyond that page.

A failed login clears the corresponding old token. Successful tokens last one hour; run login again after expiration. Activation accepts an omitted body or `{}`. It returns 400 for malformed IDs or unsupported body fields, 404 for a missing auction, and 409 at or after the deadline, including for an already-active auction. Basic users cannot create or activate auctions.

## Updating an existing Postman import

Importing this JSON file creates a snapshot in Postman; editing the repository file does not automatically refresh that imported collection. Re-import the updated collection, replacing the previous copy when that option is offered. Avoid running an older duplicate with the same name. Automatic repository synchronization is a separate setup; see [Postman import documentation](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/).

Keep your existing environment so its locally entered passwords are preserved. The new bid script defaults to `1100000` when `bid_amount` is absent; add that variable only if you want another amount. Run Basic login again to capture `buyer_id`; bid IDs and amounts are captured automatically. The environment JSON is also updated for fresh imports, but its credentials remain blank.

## Validation scope

The collection was checked against the official Postman Collection v2.1 draft-07 schema. Embedded scripts were syntax-checked and exercised offline with representative responses, including variable capture, failed-login cleanup, automatic deadlines, tie handling, and winner checks.

On November 11, 2026, the collection was imported into the Postman desktop app and exercised against the local API using a separate **Vehicle Auction — Postman test** environment. All 13 requests passed in the final clean scenario, covering 24 collection assertions. The winner request was sent again after a short deadline and passed both assertions with the auction visibly ended and the earliest equal-highest bid as winner.

The Runner Start button remained disabled, so requests were sent manually in collection order. An initial manual resend of the first bid changed the saved reference and caused the tie assertion to fail; the scenario was repeated on a fresh auction, sending each intended bid once, and passed. Local auction/bid records were created and retained. The temporary credential-import file was removed; credentials were never added to the repository templates.

Before repeating that short-deadline setup, clear the environment's `auction_end_time` or supply a new future timestamp. This live execution validates the collection's scenarios, not exhaustive API failure or concurrency coverage. Missing Postman scenarios include authentication/role failures, malformed inputs, missing auctions, bids on drafts or after expiry, and a higher bid replacing the leader; the repository's automated suites cover additional behavior. No application/database tests are needed solely to change these import instructions.

Reference: [Postman variable scopes and scripting](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-variables/).
