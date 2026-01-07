import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"

export async function validateSAML(samlResponse) {
  return new Promise((resolve, reject) => {
    const options = {
      request_body: { SAMLResponse: samlResponse },
      // Optional: set to false if your org requires encrypted assertions
      allow_unencrypted_assertion: true 
    };

    const sp = new saml2.ServiceProvider(reciterSamlConfig.samlOptions);
    const idp = new saml2.IdentityProvider(reciterSamlConfig.idpOptions);
  

    sp.post_assert(idp, options, (err, saml_response) => {
      if (err) {
        console.error("SAML Assertion Error:", err);
        return resolve(null);
      }
      // Extract user attributes from the IdP response
      const attrs = saml_response.user?.attributes || {};
      console.log("attrs******************",attrs);
      const samlUser = {
        email: attrs["user.email"]?.[0] || attrs["email"]?.[0] || attrs['userPrincipalName']?.[0],
        personIdentifier: attrs["CWID"]?.[0] || attrs["uid"]?.[0],
        firstName: attrs["urn:oid:2.5.4.42"]?.[0] || "",
        lastName: attrs["urn:oid:2.5.4.4"]?.[0] || "",
      };
      
    console.log('samlUser', samlUser);
      // saml_response.user contains the attributes from your IDP
      // Example: { name_id: "...", attributes: { email: "...", role: "..." } }
      resolve(samlUser);
    });
  });
}