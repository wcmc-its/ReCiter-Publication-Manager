// @ts-nocheck
import { useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function Finalize() {
  useEffect(() => {
    console.log('coming into finalize useEffect method******************')
    // This triggers the CredentialsProvider 'authorize' method
    // 'credentials' is the ID of your provider in [...nextauth].js
    signIn('credentials', { callbackUrl: '/search' });
  }, []);

  return <div>Verifying Organization Credentials...</div>;
}