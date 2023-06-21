import React from "react";
import { Row, Container} from "react-bootstrap";
import styles from "./NoAccess.module.css"; 


const NoAccess: React.FC = () => {
    return (
        <>
        <Container className={styles.noAccessContainer}>
            <Row>
                <span className={styles.noAccessText}>
                    {
                        "Sorry, you don't have access to the system. Please, contact your administrator."
                    }
                </span>
            </Row>
        </Container>
        </>
    )
}
export default NoAccess;
