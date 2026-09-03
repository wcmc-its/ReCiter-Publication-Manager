import Link from 'next/link'
import { Row, Container } from 'react-bootstrap'
import styles from '../components/elements/Error/Error.module.css'

// No AppLayout, no getLayout, no session. This page is statically prerendered and served for
// every unmatched URL, so anything that differs between server and client -- the attempted
// path, a session-derived link target -- is a hydration mismatch (React #425) that drops the
// whole root to client rendering, defeating the point of surviving a broken bundle.
// "/" already redirects server-side to the right landing page per role, see pages/index.js.
const NotFoundPage = () => (
    <Container className={styles.errorContainer}>
        <Row>
            <span className={styles.errorTextNeutral}>
                We couldn&apos;t find that page.
                <br />
                <Link href="/">Go back to Publication Manager</Link>
            </span>
        </Row>
    </Container>
)

export default NotFoundPage
