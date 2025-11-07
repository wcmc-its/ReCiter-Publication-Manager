import fs from 'fs';

export const reciterSamlConfig = {
   samlOptions : {
      assert_endpoint: process.env.ACS_URL, // ACS URL
      entity_id: process.env.ENTITY_ID, // Your SP entity ID
      certificate: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.crt").toString(),
      private_key: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.key").toString(),
    },

   idpOptions : {
      sso_login_url: process.env.SSO_LOGIN_URL,
      sso_logout_url: process.env.SSO_LOGOUT_URL,
      certificates: [
                  fs.readFileSync(process.cwd() + "/config/certs/idp.crt").toString()
              ]
    }

}
