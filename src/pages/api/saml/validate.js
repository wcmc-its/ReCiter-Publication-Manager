import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"

export async function validateSAML(samlResponse) {
  console.log('=== SAML VALIDATE START ===');
  console.log('SAML validate - Input samlResponse length:', samlResponse?.length || 'null/undefined');
  console.log('SAML validate - samlResponse (first 200 chars):', samlResponse?.substring(0, 200) || 'null/undefined');
  
  return new Promise((resolve, reject) => {
    const options = {
      request_body: { SAMLResponse: samlResponse },
      // Optional: set to false if your org requires encrypted assertions
      allow_unencrypted_assertion: true 
    };

    console.log('SAML validate - Options:', JSON.stringify(options, null, 2));
    console.log('SAML validate - reciterSamlConfig.samlOptions:', JSON.stringify(reciterSamlConfig.samlOptions, null, 2));
    console.log('SAML validate - reciterSamlConfig.idpOptions:', JSON.stringify(reciterSamlConfig.idpOptions, null, 2));

    const sp = new saml2.ServiceProvider(reciterSamlConfig.samlOptions);
    const idp = new saml2.IdentityProvider(reciterSamlConfig.idpOptions);
  
    console.log('SAML validate - ServiceProvider and IdentityProvider created');

    sp.post_assert(idp, options, (err, saml_response) => {
      console.log('SAML validate - post_assert callback triggered');
      
      if (err) {
        console.error("SAML validate - SAML Assertion Error:", err);
        console.error("SAML validate - Error details:", JSON.stringify(err, null, 2));
        return resolve(null);
      }
      
      console.log('SAML validate - Raw saml_response:', JSON.stringify(saml_response, null, 2));
      console.log('SAML validate - saml_response.user:', JSON.stringify(saml_response.user, null, 2));
      
      // Extract user attributes from the IdP response
      const attrs = saml_response.user?.attributes || {};
      console.log('SAML validate - Extracted attributes:', JSON.stringify(attrs, null, 2));
      
      const samlUser = {
        email: attrs["user.email"]?.[0] || attrs["email"]?.[0] || attrs['userPrincipalName']?.[0],
        personIdentifier: attrs["CWID"]?.[0] || attrs["uid"]?.[0],
        firstName: attrs["urn:oid:2.5.4.42"]?.[0] || "",
        lastName: attrs["urn:oid:2.5.4.4"]?.[0] || "",
      };
      
      console.log('SAML validate - Final samlUser object:', JSON.stringify(samlUser, null, 2));
      console.log('=== SAML VALIDATE END ===');
      
      // saml_response.user contains the attributes from your IDP
      // Example: { name_id: "...", attributes: { email: "...", role: "..." } }
      resolve(samlUser);
    });
  });
}