// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { reciterConfig } from "../../../../config/local";
import {findOrcreateAdminUser,persistUserLogin} from "../../../utils/samlUtils";
//import { encode } from "next-auth/jwt";

console.log({
  saml2: typeof saml2,
  reciterSamlConfig: typeof reciterSamlConfig,
  reciterConfig: typeof reciterConfig,
  findOrcreateAdminUser: typeof findOrcreateAdminUser,
  persistUserLogin: typeof persistUserLogin,
  encode: typeof encode, // 👈 changed from NextAuthJwt
});

export default async function handler(req, res) {
   console.log("coming into this function saml-acs",req.method); 
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Create Service Provider (SP) and Identity Provider (IdP)
    const sp = new saml2.ServiceProvider(reciterSamlConfig.samlOptions);
    const idp = new saml2.IdentityProvider(reciterSamlConfig.idpOptions);

    // Verify that SAMLResponse exists
    const samlResponse = req.body?.SAMLResponse;
    if (!samlResponse) {
      return res.status(400).send("Missing SAMLResponse");
    }

    // Validate the SAML response
   sp.post_assert(idp, { request_body: req.body }, async (error, response) => {
        console.log('Post Assert************************',error);
        if (error) {
        console.error("SAML post_assert failed:", error);
        return res.status(401).send("SAML assertion failed");
      }
     
      // Extract user attributes from the IdP response
      const attrs = response.user?.attributes || {};
      console.log("attrs******************",attrs);
      const samlUser = {
        email: attrs["user.email"]?.[0] || attrs["email"]?.[0] || attrs['userPrincipalName']?.[0],
        personIdentifier: attrs["CWID"]?.[0] || attrs["uid"]?.[0],
        firstName: attrs["urn:oid:2.5.4.42"]?.[0] || "",
        lastName: attrs["urn:oid:2.5.4.4"]?.[0] || "",
      };
      const adminUser =  await findOrcreateAdminUser(samlUser.personIdentifier,samlUser.email,samlUser.firstName,samlUser.lastName)
      console.log('adminUser in saml-acs',adminUser)
      if(adminUser)
        {
            if(samlUser.personIdentifier && reciterConfig.asms.asmsApiBaseUrl && reciterConfig.asms.userTrackingAPI 
                        && reciterConfig.asms.userTrackingAPIAuthorization)
                persistUserLogin(samlUser.personIdentifier);	
           
        }
        const sessionPayload = {
            name: `${samlUser.firstName} ${samlUser.lastName}`.trim(),
            email: samlUser.email,
            sub: samlUser.personIdentifier, // Use personIdentifier as the unique subject ID
            jti: 'a-unique-jwt-id-' + Date.now(),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (1 * 24 * 60 * 60), // 1 days expiry
            // Include other custom attributes if needed:
            // roles: ['some-role'], 
        };
        const { encode } = await import("next-auth/jwt");
        // 2. Manually encode the JWT
        const jwt = await encode({
            token: sessionPayload,
            secret: process.env.NEXTAUTH_SECRET,
        }); 
        // 3. Manually set the HTTP cookie header
        // Crucial: Use the correct cookie name and flags based on your environment
        res.setHeader('Set-Cookie', [
            `__Secure-next-auth.session-token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax`,
            // If running on http://localhost without HTTPS, you might need the non-secure name:
            // `next-auth.session-token=${jwt}; Path=/; HttpOnly; SameSite=Lax`,
        ]);
        
        // 4. Redirect the user to the main app page
        return res.redirect(302, '/search'); 
    
   });
    
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}

