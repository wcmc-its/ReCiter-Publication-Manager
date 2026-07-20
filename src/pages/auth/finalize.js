import { useEffect, useState  } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router'; // Use this for Pages Router

export default function Finalize() {
    const router = useRouter();
    const [status, setStatus] = useState('loading');
     const [errorDetail, setErrorDetail] = useState(null);

    useEffect(() => {
      // If the IdP already redirected back with an error in the query string,
    // catch that before even attempting signIn again.
    if (router.query?.error) {
      console.error('Finalize - Error present in URL on load:', router.query.error);
      setStatus('error');
      setErrorDetail(`Redirect error: ${router.query.error}`);
      return;
    }

    let cancelled = false;   
    const performSignIn = async () => {
        console.log("Attempting to trigger signIn...");
        
        // Guard against a hung request so the page never just sits blank forever
      const timeout = setTimeout(() => {
        if (!cancelled) {
          console.error('Finalize - signIn timed out after 15s');
          setStatus('error');
          setErrorDetail('Sign-in request timed out. Check network tab / IdP response time.');
        }
      }, 15000);

      try
       {

            // We set redirect: false to prevent the jump to the login page
            // This allows us to see the error in the browser console
            const result = await signIn('saml', { 
            callbackUrl: '/search',
            redirect: false 
            });

            clearTimeout(timeout);
            if (cancelled) return;


            console.log("SignIn Result:", result);

            if (result?.error) {
            console.error("Sign in failed with error:", result.error);
            setStatus('error');
            setErrorDetail(result.error);
            } else if (result?.ok) {
            console.log("Finalize - Sign in successful, redirecting to:", result.url);
            setStatus('success');
            router.push(result.url || '/search');
            //window.location.href = result.url;
            } else {
            console.warn("Finalize - Unexpected result:", result);
            setStatus('error');
            setErrorDetail('Unexpected empty result from signIn — likely a thrown exception client-side, check Network tab for the /api/auth/callback/saml request/response.');
            }
        }
        catch (err) {
        // This is the block your original code was missing entirely.
        // Any network failure, thrown exception inside next-auth's client code,
        // or unexpected non-JSON response lands here instead of disappearing silently.
        clearTimeout(timeout);
        if (cancelled) return;
        console.error('Finalize - signIn threw an exception:', err);
        setStatus('error');
        setErrorDetail(err?.message || String(err));
      } 
        console.log("=== FINALIZE.JS END ===");
    };

    performSignIn();
    return () => {
      cancelled = true;
    };
  }, [router, router.query]);

  // Rendering SOMETHING is critical — this is what was missing before,
  // and is the direct cause of the blank page regardless of signIn's outcome.
  if (status === 'loading') {
    return <div>Signing you in…</div>;
  }
  if (status === 'error') {
    return (
      <div>
        <p>Sign-in failed.</p>
        <pre style={{ color: 'red' }}>{errorDetail}</pre>
      </div>
    );
  }
  return <div>Redirecting…</div>;
}