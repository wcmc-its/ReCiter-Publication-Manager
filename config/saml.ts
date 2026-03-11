import fs from 'fs';

export const reciterSamlConfig = {
   samlOptions : {
      assert_endpoint: process.env.ACS_URL, // ACS URL
      entity_id: process.env.ENTITY_ID, // Your SP entity ID
      certificate: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.crt").toString(),
      private_key: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.key").toString(),
      sign_get_request: false,
       auth_context: { comparison: "exact" },
      force_authn: false,
      sign_post_request: false,
      nameid_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
      skip_request_compression: true, // disables XML compression to match v3
    },

   idpOptions : {
      sso_login_url: process.env.SSO_LOGIN_URL,
      sso_logout_url: process.env.SSO_LOGOUT_URL,
      certificates: [
                  fs.readFileSync(process.cwd() + "/config/certs/idp.crt").toString()
              ]
    }

}
