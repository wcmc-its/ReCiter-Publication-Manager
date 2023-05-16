import getConfig from 'next/config';
const {publicRuntimeConfig } = getConfig()
export const getSigninUrl = () => {
	console.log('Login Provider************************',publicRuntimeConfig.loginProvider);
    return publicRuntimeConfig.loginProvider !== "SAML"
        ? `${window.location.origin}/login`
        : `${window.location.origin}/api/saml/assert?callbackUrl=/search`;
};