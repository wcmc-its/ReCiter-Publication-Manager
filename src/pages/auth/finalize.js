import { useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function Finalize() {
    useEffect(() => {
    const performSignIn = async () => {
        console.log("Attempting to trigger signIn...");
        
        // We set redirect: false to prevent the jump to the login page
        // This allows us to see the error in the browser console
        const result = await signIn('saml', { 
        callbackUrl: '/search',
        redirect: false 
        });

        console.log("SignIn Result:", result);

        if (result?.error) {
        console.error("Sign in failed with error:", result.error);
        } else if (result?.ok) {
        window.location.href = result.url;
        }
    };

    performSignIn();
    }, []);
}