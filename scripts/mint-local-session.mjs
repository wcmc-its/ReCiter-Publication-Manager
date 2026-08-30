// Mint a next-auth session cookie for the LOCAL dev server, so the /authorships page can be
// driven in a browser without going through SAML. Local-only: it signs with the NEXTAUTH_SECRET
// already in .env.local and is useless against any deployed environment.
//
//   node scripts/mint-local-session.mjs <cwid> <userID>
//
// Prints only the cookie value. The secret is read from the environment and never echoed.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const cwid = process.argv[2] || "paa2013";
const userID = Number(process.argv[3] || 40099);
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) { console.error("NEXTAUTH_SECRET not found in environment or .env.local"); process.exit(1); }

// Shape mirrors what the code actually reads:
//   resolveCurator()   -> token.username, token.databaseUser.userID
//   src/middleware.ts  -> JSON.parse(token.userRoles), so userRoles is a JSON STRING of an
//                         array of { personIdentifier, roleLabel }, not an array. Passing an
//                         array makes JSON.parse throw and the request 401s with no clue why.
const token = {
  name: cwid, email: `${cwid}@med.cornell.edu`, sub: cwid,
  username: cwid,
  // AppLayout.jsx gates the whole app on databaseUser.status === 1 — omit it and every page
  // renders <NoAccess/> even though middleware let the request through.
  databaseUser: { userID, personIdentifier: cwid, status: 1 },
  userRoles: JSON.stringify([
    { personIdentifier: cwid, roleLabel: "Superuser" },
    { personIdentifier: cwid, roleLabel: "Reporter_All" },
    { personIdentifier: cwid, roleLabel: "Curator_Self" },
  ]),
};

console.log(await encode({ token, secret, maxAge: 60 * 60 * 8 }));
