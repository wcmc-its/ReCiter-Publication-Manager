import React from "react";
import { Row, Container} from "react-bootstrap";
import styles from "./Error.module.css";


const Error: React.FC<{ statusCode?: number }> = ({ statusCode }) => {
    const isServerError = statusCode >= 500;
    return (
        <Container className={styles.errorContainer}>
            <Row>
                <span className={isServerError ? styles.errorText : styles.errorTextNeutral}>
                    {
                        statusCode === 404
                            ? "We couldn't find that page."
                            : "We encountered an unexpected error. Please refresh the page or try again later."
                    }
                </span>
            </Row>
        </Container>
    )
}
export default Error;
