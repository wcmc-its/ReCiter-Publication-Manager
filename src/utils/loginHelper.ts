export const getSigninUrl = () => {
	console.log('Login Provider************************',process.env.NEXT_PUBLIC_LOGIN_PROVIDER);
    return process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};