import saml2 from "saml2-js"
import axios from "axios"
//import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterSamlConfig }  from "../../../../config/saml"
//import { getCsrfToken } from "next-auth/react";

export default async function handler(req, res) {
    console.log('coming into handler function',req.method,req.headers.host);
    if (req.method === "POST") {
        const { data, headers } = await axios.get("/api/auth/csrf", {
            baseURL: "https://" + req.headers.host,
        });
        console.log("CSRF response data:", data);
        console.log("CSRF response headers:", headers);
        //console.log("data",data);
        const { csrfToken } = data;
      /*  const csrfToken = await getCsrfToken({ req });
        console.log('csrfToke********',csrfToken);
        const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));
        console.log('encodedSAMLBody',encodedSAMLBody);
        //res.setHeader("set-cookie", headers["set-cookie"] ?? "");
        res.setHeader("Content-Type", "text/html");
        /*return res.send(`
                <html>
                <body onload="document.forms[0].submit()">
                    <form action="/api/auth/callback/saml" method="POST">
                    <input type="hidden" name="csrfToken" value="" />
                    <input type="hidden" name="samlBody" value="${encodedSAMLBody}" />
                    </form>
                </body>
                </html>
            `);*/

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
        /*const formData = req.body; // or parse SAMLResponse from body
        console.log("formData**************",formData);
        const samlResponse = formData.SAMLResponse;
        console.log("samlResponse**************",samlResponse);
        const csrfToken = await getCsrfToken({ req });
        console.log("csrfToken**************",csrfToken);
         const encodedSAMLBody = encodeURIComponent(samlResponse);
        console.log("encodedSAMLBody**************",encodedSAMLBody);
            const html = `
                <html>
                <body onload="document.forms[0].submit()">
                    <form action="/api/auth/callback/saml" method="POST">
                    <input type="hidden" name="csrfToken" value="${csrfToken ?? ''}"/>
                    <input type="hidden" name="samlBody" value="${encodedSAMLBody}"/>
                    </form>
                </body>
                </html>
            `;
            res.setHeader("Content-Type", "text/html"); // important!
            res.status(200).send(html);*/
    }

    const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
    const createLoginRequestUrl = (idp, options = {}) =>
        new Promise((resolve, reject) => {
            sp.create_login_request_url(idp, options, (error, loginUrl) => {
                if (error) {
                    reject(error);
                }
                resolve(loginUrl);
            });
        });

    try {
        const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);
        console.log("idp",idp);
        const loginUrl = await createLoginRequestUrl(idp);
        console.log("loginUrl", loginUrl);
        return res.redirect(loginUrl);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
}
