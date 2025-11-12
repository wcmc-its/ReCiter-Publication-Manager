// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { reciterConfig } from "../../../../config/local";
import {findOrcreateAdminUser,persistUserLogin,createOneTimeToken,verifyOneTimeToken} from "../../../utils/samlUtils";
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
        console.log('Post Assert************************');
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
                persistUserLogin(samlUser.personIdentifier)
                .catch(error => {
                  // Log the error to a system like Sentry, CloudWatch, etc.
                  console.error("Failed to write the login to ASMS:", error);
                  // The error is now contained and will not crash the process.
                });	
             console.log('PersistUserLoginCalled ****************'); 
        }
        /*const sessionPayload = {
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
        }*/
/*const nextAuthUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback/saml`;
        console.log("nextAuthUrl****************",nextAuthUrl);
        const nextAuthResponse = await fetch(nextAuthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      samlResponse,
      redirect: "manual",
    });
    console.log("nextAuthResponse****************",nextAuthResponse);
    // 3️⃣ Get the Set-Cookie header from NextAuth
    const cookieHeader = nextAuthResponse.headers.get("set-cookie");
   console.log("CookieHeader********************",cookieHeader);
    if (!cookieHeader) {
      throw new Error("NextAuth did not return a session cookie");
    }
    const redirectResponse = res.redirect(new URL("/", process.env.NEXTAUTH_URL));
    redirectResponse.headers.set("Set-Cookie", cookieHeader);
    console.log("redirectResponse********************",redirectResponse);
    return redirectResponse;*/

        
        /*.setHeader('Set‑Cookie', 
          `__Secure-next-auth.session-token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*60*60}`);

         console.log("Set‑Cookie header:", `__Secure-next-auth.session-token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max‑Age=${30 * 24 * 60 * 60}`); 
        // 4. Redirect the user to the main app page
        return res.redirect(302, '/'); */

          // Create the secure, one-time token
        const oneTimeToken = createOneTimeToken(samlUser);

        // The final NextAuth sign-in URL
    const callbackUrl = req?.query?.RelayState || '/'; // Use RelayState or default to home

    // Redirect to the NextAuth Credentials Sign In page, passing the token as a query parameter
    // The provider ID MUST match the `id` in your NextAuth config: 'saml-credentials'
    const nextAuthSignInUrl = `/api/auth/callback/saml?token=${oneTimeToken}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    console.log("nextAuthSignInUrl*****************************",nextAuthSignInUrl);
    return res.redirect(302, nextAuthSignInUrl);
    
   });
    
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}

