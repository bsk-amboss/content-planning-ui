// One-off helper: generates JWT_PRIVATE_KEY + JWKS for Convex Auth and prints
// them to stdout in `KEY="VALUE"` form so they can be piped to `convex env set`.
//
// Run via `node scripts/generate-auth-keys.mjs` (or via the `setup:auth` script
// in package.json which also pushes them to the Convex deployment).
//
// Source: https://labs.convex.dev/auth/setup/manual
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

process.stdout.write(
  `JWT_PRIVATE_KEY=${JSON.stringify(privateKey.trimEnd().replace(/\n/g, " "))}\n`,
);
process.stdout.write(`JWKS=${JSON.stringify(jwks)}\n`);
