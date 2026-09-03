import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { Row, Container } from 'react-bootstrap'
import styles from '../components/elements/Error/Error.module.css'
import { getCapabilities, getLandingPage } from '../utils/constants'

// Deliberately no AppLayout and no getLayout: this page has to render without a
// session or redux so it stays statically prerendered and usable when the app breaks.
const NotFoundPage = () => {
    const router = useRouter()
    const { data: session, status } = useSession()
    const userRoles = status === 'authenticated' && session?.data?.userRoles
        ? JSON.parse(session.data.userRoles)
        : null
    const landingPage = userRoles ? getLandingPage(getCapabilities(userRoles)) : '/'

    return (
        <Container className={styles.errorContainer}>
            <Row>
                <span className={styles.errorTextNeutral}>
                    We couldn&apos;t find that page.
                    <br />
                    {router.asPath}
                    <br />
                    <Link href={landingPage}>Go back to Publication Manager</Link>
                </span>
            </Row>
        </Container>
    )
}

export default NotFoundPage
