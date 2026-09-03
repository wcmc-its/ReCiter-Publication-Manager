import Error from '../components/elements/Error/Error'

// src/middleware.ts redirects here when a session carries no usable roles, or when the auth
// check itself throws. Without this page those redirects 404, which since the custom 404
// landed reads as "we couldn't find that page" -- wrong for what is an authorization failure.
const MiddlewareErrorPage = () => <Error statusCode={500} />

export default MiddlewareErrorPage
