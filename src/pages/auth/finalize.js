import { useEffect } from 'react';
import { signIn } from 'next-auth/client';
import { useRouter } from 'next/router'; // Use this for Pages Router

export default function Finalize() {
    const router = useRouter();
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
        console.log("Finalize - Sign in successful, redirecting to:", result.url);
        router.push(result.url || '/search');
        //window.location.href = result.url;
        } else {
        console.warn("Finalize - Unexpected result:", result);
        }
        
        console.log("=== FINALIZE.JS END ===");
    };

    performSignIn();
    }, [router]);
}