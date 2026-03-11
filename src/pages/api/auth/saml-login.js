import { ServiceProvider } from 'saml2-js';
import { reciterSamlConfig }  from "../../../../config/saml";
import zlib from "zlib";

export default async function handler(req, res) {
  const sp = new ServiceProvider(reciterSamlConfig.samlOptions);
  const idp = reciterSamlConfig.idpOptions;

  sp.create_login_request_url(idp, {}, (err, loginUrl, requestId) => {

  if (err) {
    return res.status(500).send(err.message);
  }
  console.log("Full login URL:", loginUrl);

  const samlRequest = new URL(loginUrl).searchParams.get("SAMLRequest");
  console.log("Raw SAMLRequest (base64):", samlRequest);

 try {

  const compressed = Buffer.from(samlRequest, "base64");

  zlib.inflateRaw(compressed, (err, decoded) => {

    if (err) {
      console.error("Error inflating SAMLRequest:", err);
    } else {
      console.log("Decoded AuthnRequest XML:\n", decoded.toString());
    }

  });

} catch (e) {
  console.error("Failed decoding SAMLRequest", e);
}
  const form = `
  <html>
    <body onload="document.forms[0].submit()">
      <form method="POST" action="${process.env.SSO_LOGIN_URL}">
        <input type="hidden" name="SAMLRequest" value="${samlRequest}" />
      </form>
    </body>
  </html>
  `;

  res.send(form);

});
  
  
}
