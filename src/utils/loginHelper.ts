export const getSigninUrl = () => {
    return process.env.LOGIN_PROVIDER !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};