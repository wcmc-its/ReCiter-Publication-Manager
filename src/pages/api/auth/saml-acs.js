// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { reciterConfig } from "../../../../config/local";
import {findOrcreateAdminUser,persistUserLogin,createOneTimeToken,verifyOneTimeToken} from "../../../utils/samlUtils";
import { encode } from "next-auth/jwt";
import { getCsrfToken } from "next-auth/react";
import { signIn } from 'next-auth/react';

export default async function handler(req, res) {
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
  }
