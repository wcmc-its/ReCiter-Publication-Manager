// pages/auth/saml-login-handler.js

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';

const SamlLoginHandler = () => {
  const router = useRouter();
// Destructure query params, assuming 'token' and 'callbackUrl' are in the URL
  const { token, callbackUrl = '/' } = router.query;

  // 🚨 CRITICAL: Use the session hook to monitor the client-side state
  const { status } = useSession();

 useEffect(() => {
    console.log("saml-handler: Initial check.", { isReady: router.isReady, tokenExists: !!token, status });

    // 1. Only proceed if:
    //    a. Router is ready (query params are available).
    //    b. We have a token.
    //    c. We are not already signed in (to prevent loops).
    if (router.isReady && token && status === 'unauthenticated') {
      
      console.log("saml-handler: Attempting automatic sign-in...");

      // Call the signIn function
      signIn('saml', {
        callbackUrl: callbackUrl, 
        redirect: false, // Prevents NextAuth from auto-redirecting
        token: token,   
      })
      .then((result) => {
        // This 'result' tells you if the *server* successfully created the session cookie.
        // It does NOT tell you if the *client* has finished reading it yet.
        console.log("saml-handler: Server sign-in attempt finished.", result);
        
        if (result && result.error) {
          // Failure on the server side (e.g., token validation failed)
          console.error("SAML sign-in failed:", result.error);
          router.replace(`/auth/error?error=${result.error}`);
        }
        // If result.ok is true, we just wait for useEffect 2 to pick up the session change.
      })
      .catch((err) => {
        console.error("saml-handler: Network error during sign-in:", err);
        router.replace('/auth/error?error=NetworkError');
      });
    } else if (router.isReady && !token) {
        // Handle missing token immediately
        router.replace('/auth/error?error=MissingToken');
    }
  }, [router.isReady, token, callbackUrl, status]); // status is added to prevent re-running if already authenticated

  // --- useEffect 2: Wait for the Session Checkpoint ---
  useEffect(() => {
    // 2. Wait until the client-side session status confirms authentication
    //    and we have a valid session object.
    if (status === 'authenticated') {
      console.log("saml-handler: Session Checkpoint passed. Redirecting to final URL.");
      
      // The session is confirmed! Now, we can safely navigate.
      // Use replace to avoid the user hitting this page with the back button.
      router.replace(callbackUrl); 
    }
  }, [status, callbackUrl, router]); // Only runs when status changes

// Display a loading state while we are waiting for the server response (useEffect 1) 
  // or the client session to load (useEffect 2).
  if (status === 'loading' || !router.isReady) {
    return (
      <div>
        <p>Signing you in via SAML... Please wait a moment.</p>
        
      </div>
    );
  }
  
  // Fallback for when the initial sign-in fails but status isn't authenticated
  return null;
};

export default SamlLoginHandler;