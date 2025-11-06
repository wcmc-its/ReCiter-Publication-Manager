import { ServiceProvider } from 'saml2-js';
import { reciterSamlConfig } from "../../../config/saml.js";;

export default async function handler(req, res) {
  const sp = new ServiceProvider(reciterSamlConfig.saml_options);
  const idp = samlConfig.idp_options;

  sp.create_login_request_url(idp, {}, (err, loginUrl, requestId) => {
    if (err) return res.status(500).send(err.message);

    // Redirect user to IdP
    res.redirect(loginUrl);
  });
}
