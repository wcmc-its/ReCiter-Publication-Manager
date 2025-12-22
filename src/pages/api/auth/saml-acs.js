
import { getCsrfToken } from "next-auth/client";

export const config = {
  api: {
    bodyParser: true, 
  },
};

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end();

    // 1. Next.js bodyParser should give you req.body
    // If req.body is undefined here, use: const samlResponse = req.body?.SAMLResponse;
    const samlResponse = req.body.SAMLResponse;

    if (!samlResponse) {
      console.error("Missing SAMLResponse in body");
      return res.status(400).send("No SAML response received from IdP");
    }

    // 2. Get NextAuth CSRF Token
    const csrfToken = await getCsrfToken({ req });

    res.setHeader("Content-Type", "text/html");
    return res.send(
              `<html>
            <body>
              <form action="/api/auth/callback/saml" method="POST">
                <input type="hidden" name="csrfToken" value="${csrfToken}"/>
                <input type="hidden" name="samlBody" value="${samlResponse}"/>
              </form>
              <script>
                document.forms[0].submit();
              </script>
            </body>
          </html>`
          );
      }
    
