import { ServiceProvider } from 'saml2-js';
import { reciterSamlConfig }  from "../../../../config/saml";

export default async function handler(req, res) {
  console.log("coming into this function",req,res);  
  const sp = new ServiceProvider(reciterSamlConfig.samlOptions);
  const idp = reciterSamlConfig.idpOptions;

  sp.create_login_request_url(idp, {}, (err, loginUrl, requestId) => {
    console.log('err***',err?.message,loginUrl,requestId);
    if (err) return res.status(500).send(err.message);
    const samlRequest = new URL(loginUrl).searchParams.get("SAMLRequest");
    console.log("Base64 SAMLRequest:", samlRequest?.slice(0, 80) + "...");
    // Redirect user to IdP
    res.redirect(loginUrl);
  });
}
