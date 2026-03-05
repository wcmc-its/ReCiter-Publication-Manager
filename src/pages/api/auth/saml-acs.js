import { reciterSamlConfig }  from "../../../../config/saml"
import { validateSAML } from "../saml/validate";
import { encrypt } from "../saml/crypto";

export default async function handler(req, res) {
  
    if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

    
    try
    {
        // Verify that SAMLResponse exists
        const samlResponse = req.body?.SAMLResponse;
        if (!samlResponse) {
        return res.status(400).send("Missing SAMLResponse");
        }
        
        const samlUser = await validateSAML(req.body.SAMLResponse);
        if (!samlUser) {
        return res.redirect('/auth/error?error=SAML_Invalid');
        }
        // Encrypt the payload so the user cannot modify their roles in the browser
        const encryptedBridgeData = encrypt(JSON.stringify(samlUser));

        // Set a short-lived temporary cookie
        res.setHeader('Set-Cookie', `saml_bridge=${encryptedBridgeData}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`);
        // 3. Redirect to the bridge page
        res.redirect(302, '/auth/finalize');
    }
    catch (err) {
    console.error("[SAML-ACS]", err);
    res.redirect('/auth/error?error=Callback_Error');
  }
}