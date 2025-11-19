// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { reciterConfig } from "../../../../config/local";
import {findOrcreateAdminUser,persistUserLogin,createOneTimeToken,verifyOneTimeToken} from "../../../utils/samlUtils";
import { encode } from "next-auth/jwt";
import { getCsrfToken } from "next-auth/react";
//import authOptions from "./[...nextauth].jsx";
//import { signIn } from 'next-auth/core/http';


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
  const serverCsrfToken = await getCsrfToken({ req });
  console.log('csrf token generated on the Server side',serverCsrfToken);
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

            await signIn("saml", {
                          redirect: true,
                          email: samlUser.email,
                          name: `${samlUser.firstName} ${samlUser.lastName}`.trim(),
                        }); 
       // }
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
    //const oneTimeToken = createOneTimeToken(adminUser);

        // The final NextAuth sign-in URL
    //const callbackUrl = req?.query?.RelayState || '/search'; // Use RelayState or default to home

    // Redirect to the NextAuth Credentials Sign In page, passing the token as a query parameter
    // The provider ID MUST match the `id` in your NextAuth config: 'saml-credentials'
    //const nextAuthSignInUrl = `/auth/saml-login-handler?token=${oneTimeToken}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    //console.log("nextAuthSignInUrl*****************************",nextAuthSignInUrl);
    //return res.redirect(302, nextAuthSignInUrl);

      // 2. Perform the server-side sign-in using the 'credentials' provider
    // This calls your 'authorize' function in [...nextauth].js directly.
   /* const result = await signIn('saml', {
        token: oneTimeToken, 
        redirect: false, // Prevent the default server redirect behavior
    }, {
        req, // Pass the request object
        res, // Pass the response object
        authOptions: authOptions, // Pass your NextAuth options
    });

    // 3. Check the server-side result and perform the final redirect
    if (result && result.error) {
        // If your 'authorize' function failed, this catches it
        console.error("Server-side signIn failed:", result.error);
        return res.redirect(302, `/auth/error?error=${result.error}`);
    }

    // 4. Success! The session cookies have been securely set by NextAuth on the server.
    // Now, redirect the user directly to their final destination.
    console.log(`Server-side sign-in successful. Redirecting to: ${callbackUrl}`);
    return res.redirect(302, callbackUrl);*/

        // The final NextAuth sign-in URL: Must be '/api/auth/callback/credentials'
        // This is because we are using a Credentials Provider in the nextauth config.
        //const nextAuthCallbackUrl = '/api/auth/callback/saml'; 
        // We encode the original POST body to pass to the credentials provider
       /* const encodedSAMLBody = encodeURIComponent(JSON.stringify(adminUser));
         console.log("encodedSAMLBody******************",encodedSAMLBody); 
         
         console.log("Incoming cookies header:", req?.headers?.cookie);
          console.log("Parsed req.cookies:", req?.cookies);

         const csrfToken = req.cookies["__Host-next-auth.csrf-token"] ||
                            req.cookies["next-auth.csrf-token"]  ||
                          req.cookies["_Host-next-auth.csrf-token"];
         console.log("csrfToken*********************",csrfToken); */
         //const csrfToken = csrfCookie?.split("|")[0] || "";
          //console.log("csrfToken*********************",csrfToken);       
          //console.log("ACS cookies:", req.cookies);

        // Return HTML to the browser to auto-submit a POST request 
                // to the NextAuth callback endpoint. The browser *automatically* 
                // attaches the `next-auth.csrf-token` HTTP-only cookie.
               /* return res.send(
                    `<html>
                  <body>
                    <form id="saml-form" action="${nextAuthCallbackUrl}" method="POST" enctype="application/x-www-form-urlencoded">
                      <input type="hidden" name="csrfToken" id="csrfToken" />
                      <input type="hidden" name="email" value="${samlUser.email}"/>
                      <input type="hidden" name="samlBody" value="${encodedSAMLBody}"/>
                    </form>
                    <script>
                      // Fetch CSRF token from NextAuth API
                      fetch("/api/auth/csrf").then(r => r.json()).then(data => {
                        console.log('csrftoken**************',data.csrfToken);
                        document.getElementById("csrfToken").value = data.csrfToken;
                        document.getElementById("saml-form").submit();
                      });
                    </script>
                  </body>
                </html>`
                );*/
                
            } else {
                // Handle case where adminUser is null/not found
                return res.status(401).send("User not authorized or created.");
            }
    
   });
    
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}

