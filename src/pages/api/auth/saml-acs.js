
import axios from "axios"
import { getCsrfToken } from "next-auth/client";


export default async function handler(req, res) {
    if (req.method === "POST") {
       /* const { data, headers } = await axios.get("/api/auth/csrf", {
            baseURL: "https://" + req.headers.host,
        });*/

        // This reads the cookie ALREADY in the user's browser
        const csrfToken = await getCsrfToken({ req });
        console.log('csrftoken', csrfToken);
      //  const { csrfToken } = data;

      // Use the raw SAMLResponse string
        const samlResponse = req.body.SAMLResponse;

        res.setHeader("Content-Type", "text/html");

        //const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));

        res.setHeader("set-cookie", headers["set-cookie"] ?? "");
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
  }
