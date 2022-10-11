import { signOut, useSession} from 'next-auth/client';
export const getSigninUrl = () => {

    const [session, loading] = useSession();
    console.log("session from loginHelper***********************",session);

    return process.env.LOGIN_PROVIDER !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};