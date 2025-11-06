import fs from 'fs';

export const reciterSamlConfig = {
   samlOptions : {
      callback_url: process.env.ACS_URL, // ACS URL
      issuer: process.env.ENTITY_ID, // Your SP entity ID
      cert: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.crt").toString(),
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
