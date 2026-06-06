/**
 * DEPRECATED — see apps/api/src/scripts/bootstrap.ts
 *
 * The original seed wrote rows directly into the OIAS `users` table with a
 * bcrypt hash. Better Auth authenticates against its own `user` + `account`
 * tables using its own hasher, so those rows could never log in.
 *
 * Use:
 *   pnpm --filter @oias/api bootstrap
 *
 * Or via docker compose: the `db-init` service runs the bootstrap automatically.
 *
 * This stub stays so `pnpm db:seed` does not silently revert the database to
 * the broken state.
 */

console.warn(
  '[db:seed] This command is deprecated. Run `pnpm --filter @oias/api bootstrap` instead.',
);
console.warn(
  '[db:seed] The bootstrap script uses Better Auth to create a working login',
);
console.warn(
  '[db:seed] (admin@acme.test / password123) and seeds the same demo data.',
);
process.exit(0);
