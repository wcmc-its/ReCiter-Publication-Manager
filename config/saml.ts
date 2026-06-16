import fs from 'fs';

export const reciterSamlConfig = {
   saml_options : {
      assert_endpoint: process.env.ACS_URL, // ACS URL
      entity_id: process.env.ENTITY_ID, // Your SP entity ID
      certificate: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.crt").toString(),
      private_key: fs.readFileSync(process.cwd() + "/config/certs/reciter-saml.key").toString(),
      sign_get_request: true,
      // 1. Set to true if your IdP doesn't encrypt the SAML response (common)
  allow_unencrypted_assertion: true, 

  // 2. Prevents "Assertion not yet valid" errors due to server clock drift (in seconds)
  notbefore_skew: 2, 

  // 3. Tells the IdP what format the username should be in
  nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",

  // 4. Force SHA-256 for signing (modern standard)
  signature_algorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  digest_algorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
    },

   saml_idp_options : {
      sso_login_url: process.env.SSO_LOGIN_URL,
      sso_logout_url: process.env.SSO_LOGOUT_URL,
      certificates: [
                  fs.readFileSync(process.cwd() + "/config/certs/idp.crt").toString()
              ]
    }

}
