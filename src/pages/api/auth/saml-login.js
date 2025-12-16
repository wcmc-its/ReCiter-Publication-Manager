import { ServiceProvider } from 'saml2-js';
import { reciterSamlConfig }  from "../../../../config/saml";

export default async function handler(req, res) {
  const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
     const createLoginRequestUrl = (idp, options = {}) =>
         new Promise((resolve, reject) => {
             sp.create_login_request_url(idp, options, (error, loginUrl) => {
                 if (error) {
                     reject(error);
                 }
                 resolve(loginUrl);
             });
         });
 
     try {
         const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);
         const loginUrl = await createLoginRequestUrl(idp);
         return res.redirect(loginUrl);
     } catch (error) {
         console.error(error);
         res.status(500).send(error);
     }

  
}