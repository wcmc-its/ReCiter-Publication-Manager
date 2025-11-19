export const getSigninUrl = () => {
    return (process.env.NEXT_PUBLIC_LOGIN_PROVIDER && process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML")
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/auth/saml-login?callbackUrl=/search`;
};
