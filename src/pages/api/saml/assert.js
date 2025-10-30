import saml2 from "saml2-js"
import axios from "axios"
//import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterSamlConfig }  from "../../../../config/saml"
//import { getCsrfToken } from "next-auth/react";

export default async function handler(req, res) {
  console.log("Incoming SAML request:", req.method);

  // When IdP posts the SAMLResponse (the ACS callback)
  if (req.method === "POST") {
    const samlResponse = req.body?.SAMLResponse;

    if (!samlResponse) {
      console.error("Missing SAMLResponse in POST body");
      return res.status(400).send("Missing SAMLResponse");
    }

    // Wrap the SAMLResponse into the credentials format expected by NextAuth
    const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));

    // Return an HTML form that automatically POSTs to NextAuth’s SAML callback
    // This ensures it's treated as a same-origin form POST (bypassing CSRF)
    res.setHeader("Content-Type", "text/html");

    return res.send(`
      <html>
        <body>
          <form action="/api/auth/callback/saml" method="POST">
            <input type="hidden" name="samlBody" value="${encodedSAMLBody}" />
          </form>
          <script>
            document.forms[0].submit();
          </script>
        </body>
      </html>
    `);
  }

  // 2️⃣ When user initiates login → create redirect to IdP
  const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
  const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);

  const createLoginRequestUrl = () =>
    new Promise((resolve, reject) => {
      sp.create_login_request_url(idp, {}, (err, loginUrl) => {
        if (err) return reject(err);
        resolve(loginUrl);
      });
    });

  try {
    const loginUrl = await createLoginRequestUrl();
    console.log("Redirecting to IdP login URL:", loginUrl);
    return res.redirect(loginUrl);
  } catch (err) {
    console.error("SAML login redirect failed:", err);
    return res.status(500).send("SAML login redirect failed");
  }
}

