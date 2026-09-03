import Error from '../components/elements/Error/Error'

const ErrorPage = ({ statusCode }) => {
    return (
        <Error statusCode={statusCode} />
    )
}

ErrorPage.getInitialProps = ({ res, err }) => ({
    statusCode: res ? res.statusCode : err ? err.statusCode : 404
})

export default ErrorPage
