import { createTenantFixture } from "../helpers/local-backend";

/** Lager en fersk syntetisk fixture på test-backenden for denne kjøringen. */
export default async function globalSetup() {
  const fixture = createTenantFixture();
  process.env.E2E_FIXTURE = JSON.stringify(fixture);
}
