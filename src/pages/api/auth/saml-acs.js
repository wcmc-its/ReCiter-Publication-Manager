// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { getServerSession } from "next-auth/next";
import NextAuth from "./[...nextauth].jsx"; // import NextAuth instance
import { serialize } from "cookie";


export default async function handler(req, res) {
   console.log("coming into this function saml-acs", req,res,req.method); 
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
        console.log('Post Assert************************',error,response);
        if (error) {
        console.error("SAML post_assert failed:", error);
        return res.status(401).send("SAML assertion failed");
      }

      // Extract user attributes from the IdP response
      const attrs = response.user?.attributes || {};
      console.log("attrs******************",attrs);
      const user = {
        email: attrs["user.email"]?.[0] || attrs["email"]?.[0],
        personIdentifier: attrs["CWID"]?.[0] || attrs["uid"]?.[0],
        firstName: attrs["urn:oid:2.5.4.42"]?.[0] || "",
        lastName: attrs["urn:oid:2.5.4.4"]?.[0] || "",
      };

      // Now use NextAuth to create a session for this SAML user
     // const session = await getServerSession(req, res, NextAuth);
     // console.log("session***************",session);
       // 🔑 Create NextAuth session cookie
   // await setLoginSession(req, res, user);

    // Redirect into app (middleware will run)
    //return res.redirect("/search");
      const callbackUrl = "/search";

  // POST to the specific Credentials provider
  const credResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/callback/credentials?saml-bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: user.email,
      callbackUrl,
    }),
  });
  console.log('response************************',credResponse);
  if (!credResponse.ok) return res.status(500).send("NextAuth callback failed");

  res.redirect(callbackUrl);



    });
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
