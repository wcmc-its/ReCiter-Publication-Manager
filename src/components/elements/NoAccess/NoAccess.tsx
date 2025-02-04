import React, { useEffect, useState } from "react";
import { Row, Container} from "react-bootstrap";
import styles from "./NoAccess.module.css"; 
import { useSession } from 'next-auth/react';



const NoAccess: React.FC = () => {
//   const [session, loading] = useSession();
const { data: session, status } = useSession();
  const [noUserRoles, setNoUserRoles] = useState(false)

    useEffect(()=>{
        let userPermissions = session?.data?.userRoles && session?.data?.userRoles !="" && JSON.parse(session?.data?.userRoles);
        setNoUserRoles(!userPermissions || userPermissions =="" ? true : false)
    },[])
    return (
        <>
        <Container className={styles.noAccessContainer}>
            <Row>
                <span className={styles.noAccessText}>
                    { 
                    noUserRoles ? "You have successfully authenticated, but you don't have any roles assigned. Please contact a system administrator":
                        "Sorry, you don't have access to the system. Please, contact your administrator."
                    }
                </span>
            </Row>
        </Container>
        </>
    )
}
export default NoAccess;
