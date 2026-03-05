// Deprecated: use /api/auth/saml-acs instead.
// This file is kept empty to avoid 404s if the old URL is still referenced anywhere.
export default function handler(req, res) {
  res.redirect(307, "/api/auth/saml-acs");
}
