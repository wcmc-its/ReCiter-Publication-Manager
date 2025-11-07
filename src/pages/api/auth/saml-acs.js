// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig }  from "../../../../config/saml"
import { getServerSession } from "next-auth/next";
import NextAuth from "./[...nextauth].jsx"; // import NextAuth instance
import { signIn } from "next-auth/react";

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
       console.log("User***************",user);
      // Now use NextAuth to create a session for this SAML user
      const session = await getServerSession(req, res, NextAuth);
      console.log("session***************",session);
      
            await signIn("credentials", {
            redirect: false,
            email: user?.email,
        });

    // Redirect into app (middleware will run)
      return res.redirect("/search");
      // Option 1: set your own cookie manually (optional)
     
    });
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
