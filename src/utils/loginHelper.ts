export const getSigninUrl = () => {
    return process.env.NODE_ENV !== "production"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};