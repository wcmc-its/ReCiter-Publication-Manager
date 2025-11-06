import { ServiceProvider } from 'saml2-js';
import samlConfig from '../../../config/saml';

export default async function handler(req, res) {
  const sp = new ServiceProvider(samlConfig.saml_options);
  const idp = samlConfig.idp_options;

  sp.create_login_request_url(idp, {}, (err, loginUrl, requestId) => {
    if (err) return res.status(500).send(err.message);

    // Redirect user to IdP
    res.redirect(loginUrl);
  });
}
