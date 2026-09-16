/**
 * Database-test setup. Loaded by `bun run test:db` only — never by CI.
 *
 * Throws unless TEST_DATABASE_URL names a localhost database, then publishes it
 * as DATABASE_URL for the application code to read.
 *
 * This repo has no *.db.test.ts files yet, so `bun run test:db` exits 1 with
 * "No test files found". That is expected: vitest does not load setup files
 * when nothing matches. The wiring exists so the first database test added
 * lands correctly instead of quietly running against whatever DATABASE_URL
 * happens to be exported.
 */
import { setupTestDatabase } from "@sudobility/test-db-guard";

process.env.NODE_ENV = "test";

setupTestDatabase();
