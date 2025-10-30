import saml2 from "saml2-js"
import axios from "axios"
//import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterSamlConfig }  from "../../../../config/saml"
import { csrfToken } from "next-auth/core/lib/csrf";


export default async function handler(req, res) {
    console.log('coming into handler function',req.method,req.headers.host);
    if (req.method === "POST") {
       /* const { data, headers } = await axios.get("/api/auth/csrf", {
            baseURL: "https://" + req.headers.host,
        });*/
        const token = await csrfToken({ req });
        console.log('token********',csrfToken);
        const res = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/csrf`);
        const { csrfToken1 } = await res.json();

       // console.log("data",data);
        //const { csrfToken } = data;
        console.log('csrfToke********',csrfToken1);
        const encodedSAMLBody = encodeURIComponent(JSON.stringify(req.body));
        console.log('encodedSAMLBody',encodedSAMLBody);
        //res.setHeader("set-cookie", headers["set-cookie"] ?? "");
       // res.setHeader("Content-Type", "text/html");
       res.setHeader("Set-Cookie", serialize("next-auth.csrf-token", cookieValue, {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60
        }));

        res.status(200).json({ csrfToken1 });
        
        return res.send(
            `<html>
          <body>
            <form action="/api/auth/callback/saml" method="POST">
              <input type="hidden" name="csrfToken" value="${csrfToken1}"/>
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
