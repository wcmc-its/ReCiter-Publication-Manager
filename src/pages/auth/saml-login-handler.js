// pages/auth/saml-login-handler.js

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';

export default function SamlLoginHandler() {
  const router = useRouter();
  // Extract the token and the original destination URL (callbackUrl) from the query string
  const { token, callbackUrl = '/' } = router.query;

  useEffect(() => {
    console.log("coming into the saml login handler****************")
    // Only proceed once the router is ready and we have a token
    if (router.isReady && token) {
      
      console.log("Attempting automatic sign-in with SAML token...");
      
      // 1. Call the signIn function
      signIn('saml', {
        // The callbackUrl must be passed to ensure the user is redirected to the page 
        // they originally requested (which came from Middleware/RelayState).
        callbackUrl: callbackUrl, 
        
        // This is crucial. It tells the function NOT to perform a full browser redirect 
        // after the server-side authorization is done. We handle navigation manually below.
        redirect: false,          
        
        // Pass the token as a credential field, matching the key defined in your 
        // NextAuth Credentials Provider.
        token: token,   
      })
      .then((result) => {
        console.log("result of the saml-login handler***********",result);
        if (result && result.ok) {
          // 2. SUCCESS: The authorize function ran, the session was created.
          console.log("SAML sign-in successful. Redirecting...");
          // result.url contains the final destination URL determined by NextAuth 
          // (which should be the passed callbackUrl or the path determined by the signIn callback).
          router.push(result.url || callbackUrl); 
        } else if (result && result.error) {
          // 3. FAILURE: Token expired, authorize returned null, etc.
          console.error("SAML sign-in failed:", result.error);
          router.push(`/auth/error?error=${result.error}`);
        } else {
          // Handles cases where result is null but the router didn't push (e.g., already signed in)
          console.warn("Sign-in result was inconclusive. Redirecting to home.");
          router.push('/');
        }
      })
      .catch((err) => {
        // Handle unexpected network errors during the signIn call
        console.error("Network error during sign-in:", err);
        router.push('/auth/error?error=NetworkError');
      });
      
    } else if (router.isReady && !token) {
      // Handles direct access to this handler without a token
      router.push('/auth/error?error=MissingToken');
    }
  }, [router, token, callbackUrl]); // Dependencies for useEffect

  // Display a minimal loading screen while the sign-in process runs in the background.
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      fontFamily: 'sans-serif' 
    }}>
      <h1>🔒 Authenticating...</h1>
      <p>Please wait while we establish your secure session.</p>
      {/* You can add a spinner or loading animation here */}
    </div>
  );
}