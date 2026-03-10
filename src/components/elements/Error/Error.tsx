import React from "react";
import { Row, Container} from "react-bootstrap";
import { Footer } from "../Footer/Footer";
import Header from "../Header/Header";
import styles from "./Error.module.css"; 


const Error: React.FC = () => {
    return (
        <>
        {/* <Header/> */}
        <Container className={styles.errorContainer}>
            <Row>
                <span className={styles.errorText}>
                    {
                        "We encountered an unexpected error. Please refresh the page or try again later."
                    }
                </span>
            </Row>
        </Container>
        {/* <Footer/> */}
        </>
    )
}
export default Error;
