import saml2 from "saml2-js"
import type saml2js from "saml2-js"
import axios from "axios"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterSamlConfig }  from "../../../../config/saml"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
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

    const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
    const createLoginRequestUrl = (idp: saml2js.IdentityProvider, options = {}) =>
        new Promise<string>((resolve, reject) => {
            sp.create_login_request_url(idp, options, (error, loginUrl) => {
                if (error) {
                    reject(error);
                }
                resolve(loginUrl);
            });
        });

    try {
        const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);
        const loginUrl = await createLoginRequestUrl(idp);

        return res.redirect(loginUrl);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
}
