import React from "react";
import { Row, Container} from "react-bootstrap";
import styles from "./NoAccess.module.css"; 
import { useSession } from 'next-auth/react';
import { noAccessMessage } from "../../../utils/noAccessMessage";

const NoAccess: React.FC = () => {
  const { data: session, status } = useSession();
  const message = noAccessMessage(status, (session as any)?.data?.userRoles);
    if (!message) return null;
    return (
        <>
        <Container className={styles.noAccessContainer}>
            <Row>
                <span className={styles.noAccessText}>{message}</span>
            </Row>
        </Container>
        </>
    )
}
export default NoAccess;
