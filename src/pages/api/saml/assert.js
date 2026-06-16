import saml2 from "saml2-js"
import { reciterSamlConfig } from "../../../../config/saml"

// SP-initiated SSO entry point. Unauthenticated users land here (via the
// redirect in src/pages/index.js when NEXT_PUBLIC_LOGIN_PROVIDER=SAML),
// we build the AuthnRequest with saml2-js and bounce to the IdP. The IdP
// POSTs the SAMLResponse to /api/auth/saml-acs, which forwards into
// NextAuth's credentials callback at /api/auth/callback/saml.

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).send("Method not allowed");
    }

    const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
    const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);

    const createLoginRequestUrl = (identityProvider, options = {}) =>
        new Promise((resolve, reject) => {
            sp.create_login_request_url(identityProvider, options, (error, loginUrl) => {
                if (error) reject(error);
                else resolve(loginUrl);
            });
        });

    try {
        const loginUrl = await createLoginRequestUrl(idp);
        return res.redirect(loginUrl);
    } catch (error) {
        console.error("SAML AuthnRequest build failed:", error);
        return res.status(500).send("SAML login error");
    }
}
