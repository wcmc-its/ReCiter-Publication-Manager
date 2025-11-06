import fs from 'fs';
import path from 'path';

const samlOptions = {
  callback_url: process.env.ACS_URL, // ACS URL
  issuer: process.env.ENTITY_ID, // Your SP entity ID
  cert: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.crt").toString(),
  private_key: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.key").toString(),
};

const idpOptions = {
  sso_login_url: 'https://login-proxy-test.weill.cornell.edu/idp/profile/SAML2/Redirect/SSO',
  sso_logout_url: 'https://login-proxy-test.weill.cornell.edu/idp/profile/SAML2/Redirect/SLO',
  certificates: [
              fs.readFileSync(process.cwd() + "/config/certs/idp.crt").toString()
          ]
};

export default { saml_options: samlOptions, idp_options: idpOptions };
