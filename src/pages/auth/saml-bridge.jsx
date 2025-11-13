// pages/auth/saml-bridge.jsx
import { useEffect } from 'react';
import { getCsrfToken } from 'next-auth/react';
import { useRouter } from 'next/router';

const SamlBridgePage = () => {
    const router = useRouter();
    const { callbackUrl } = router.query;
    // You can pass the callbackUrl through to your server handler if needed

    useEffect(() => {
        const initiateLogin = async () => {
            // 1. CRUCIAL STEP: Fetch the token to ensure the 'next-auth.csrf-token' 
            //    HTTP-only cookie is set in the user's browser.
            await getCsrfToken(); 

            // 2. Redirect to your existing server-side SAML login handler
            // (e.g., /api/saml/saml-login)
            const loginUrl = callbackUrl 
                ? `/api/auth/saml-login?callbackUrl=${encodeURIComponent(callbackUrl)}` 
                : '/api/auth/saml-login';
                
            window.location.href = loginUrl; 
        };
        
        // Ensure this only runs on the client after mounting
        if (typeof window !== 'undefined') {
            initiateLogin();
        }
    }, [callbackUrl]);

    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Initializing secure login...</p>
        </div>
    );
};

export default SamlBridgePage;
