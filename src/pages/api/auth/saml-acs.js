// pages/api/auth/saml-acs.js

import saml2 from "saml2-js";
import { reciterSamlConfig } from "../../../config/saml.js"; // ensure .js extension if using ESM
import { getServerSession } from "next-auth/next";
import NextAuth from "./[...nextauth].js"; // import NextAuth instance
import { serialize } from "cookie";

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Create Service Provider (SP) and Identity Provider (IdP)
    const sp = new saml2.ServiceProvider(reciterSamlConfig.saml_options);
    const idp = new saml2.IdentityProvider(reciterSamlConfig.saml_idp_options);

    // Verify that SAMLResponse exists
    const samlResponse = req.body?.SAMLResponse;
    if (!samlResponse) {
      return res.status(400).send("Missing SAMLResponse");
    }

    // Validate the SAML response
    sp.post_assert(idp, { request_body: req.body }, async (error, response) => {
      if (error) {
        console.error("SAML post_assert failed:", error);
        return res.status(401).send("SAML assertion failed");
      }

      // Extract user attributes from the IdP response
      const attrs = response.user?.attributes || {};
      const user = {
        email: attrs["user.email"]?.[0] || attrs["email"]?.[0],
        personIdentifier: attrs["CWID"]?.[0] || attrs["uid"]?.[0],
        firstName: attrs["urn:oid:2.5.4.42"]?.[0] || "",
        lastName: attrs["urn:oid:2.5.4.4"]?.[0] || "",
      };

      // Now use NextAuth to create a session for this SAML user
      const session = await getServerSession(req, res, NextAuth);

      // Option 1: set your own cookie manually (optional)
      res.setHeader(
        "Set-Cookie",
        serialize("saml_user", JSON.stringify(user), {
          httpOnly: true,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        })
      );

      // Redirect to home or wherever you want
      return res.redirect("/");
    });
  } catch (err) {
    console.error("SAML ACS handler error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
