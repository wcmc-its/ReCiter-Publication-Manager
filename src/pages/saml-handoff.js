// pages/saml-handoff.js
import { getCsrfToken } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SamlHandoff({ csrfToken, samlResponse }) {
  const router = useRouter();

  useEffect(() => {
    if (csrfToken && samlResponse) {
      // Auto submit the form to the NextAuth credentials provider API endpoint
      document.getElementById('samlForm').submit();
    } else if (!samlResponse) {
      // Handle cases where the SAML response was somehow lost in redirect
      router.push('/auth/error?error=SAMLResponseMissing');
    }
  }, [csrfToken, samlResponse, router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Processing SAML Login...</h1>
      <p>Please wait while we sign you in.</p>
      
      {/* This form posts to the NEXTAUTH_URL/api/auth/signin/[providerId] route */}
      <form id="samlForm" method="POST" action="/api/auth/signin/saml-login">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="samlBody" value={samlResponse} />
      </form>
    </div>
  );
}

// Server-side function to get the CSRF token and the SAML data from the query
export async function getServerSideProps(context) {
  const csrfToken = await getCsrfToken(context);
  // Decode the SAML response from the query parameter
  const samlResponse = context.query.response ? decodeURIComponent(context.query.response) : null;

  return {
    props: { csrfToken, samlResponse },
  };
}
