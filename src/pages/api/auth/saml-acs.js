import saml2 from 'saml2-js';
import { samlConfig } from '@/config/saml';
import { setLoginSession } from '@/lib/nextauth-session'; // helper to call NextAuth internally

export default async function handler(req, res) {
  const sp = new saml2.ServiceProvider(samlConfig.saml_options);
  const idp = new saml2.IdentityProvider(samlConfig.saml_idp_options);

  const samlResponse = req.body?.SAMLResponse;
  if (!samlResponse) return res.status(400).send('Missing SAMLResponse');

  sp.post_assert(idp, { request_body: req.body }, async (error, response) => {
    if (error) {
      console.error('SAML post_assert failed:', error);
      return res.status(401).send('SAML assertion failed');
    }

    const attributes = response.user.attributes;
    const user = {
      email: attributes['user.email']?.[0],
      personIdentifier: attributes['CWID']?.[0],
      firstName: attributes['urn:oid:2.5.4.42']?.[0],
      lastName: attributes['urn:oid:2.5.4.4']?.[0],
    };

    await setLoginSession(req, res, user);
    res.redirect('/');
  });
}
