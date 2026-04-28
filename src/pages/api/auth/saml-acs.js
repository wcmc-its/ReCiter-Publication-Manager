import axios from "axios"

// SAML Assertion Consumer Service handler.
// IdP POSTs the SAMLResponse here; we wrap it in a CSRF-protected form
// that auto-submits to NextAuth's credentials callback at /api/auth/callback/saml,
// which validates the SAML and issues a JWT session.
//
// This URL is what the IdP has registered as the SP's ACS. The SP-side
// equivalent is configured via ASSERT_ENDPOINT env var, which must match.

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
    }

    const { data, headers } = await axios.get("/api/auth/csrf", {
        baseURL: "https://" + req.headers.host,
    });
    const { csrfToken } = data;

    const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));

    res.setHeader("set-cookie", headers["set-cookie"] ?? "");
    return res.send(
        `<html>
      <body>
        <form action="/api/auth/callback/saml" method="POST">
          <input type="hidden" name="csrfToken" value="${csrfToken}"/>
          <input type="hidden" name="samlBody" value="${encodedSAMLBody}"/>
        </form>
        <script>
          document.forms[0].submit();
        </script>
      </body>
    </html>`
    );
}
