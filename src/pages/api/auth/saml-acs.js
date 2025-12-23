
import axios from "axios"

export default async function handler(req, res) {
    if (req.method === "POST") {
        const { data, headers } = await axios.get("/api/auth/csrf", {
            baseURL: "https://" + req.headers.host,
        });
        const { csrfToken } = data;
        console.log('csrfToken',csrfToken);

        const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));
        console.log('encodedSAMLBody',encodedSAMLBody);

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
  }
