// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { reciterConfig } from "../../../../config/local";
import {findOrcreateAdminUser,persistUserLogin} from "../../../utils/samlUtils";
import { encode } from "next-auth/jwt";

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
            sub: samlUser.personIdentifier,
            userRoles: adminUser.userRoles 
        };
        console.log('sessionPayload', sessionPayload);
        console.log('encode', encode);
        // 2. Manually encode the JWT
        let jwt;
        try {
        jwt = await encode({
            token: sessionPayload,
            secret: process.env.NEXTAUTH_SECRET,
            maxAge: 30 * 24 * 60 * 60 // e.g., 30 days
        });

        } catch (err) {
        console.error('Error calling encode:', err);
        return res.status(500).send('JWT encoding failed');
        }
        
        res.setHeader('Set‑Cookie', 
          `__Secure-next-auth.session-token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*60*60}`);


        // 4. Redirect the user to the main app page
        return res.redirect(302, '/'); 
    
   });
    
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}

