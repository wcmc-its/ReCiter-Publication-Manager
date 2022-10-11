export const getSigninUrl = (sessionData) => {
    console.log("getsignURL called from LoginHelper********************", sessionData);
    return process.env.LOGIN_PROVIDER !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};