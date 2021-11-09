import React, { Component } from "react";
import { Navbar, Container} from "react-bootstrap";
import styles from "./Header.module.css";
import { useSelector } from 'react-redux';
import { signOut, useSession} from 'next-auth/client';

type Props = {
    session: any
}

const Header: React.FC<Props> = () => {
    const [session, loading] = useSession()
    return (
        <Navbar bg="primary" className={styles.topNav}>
          <div>
              <Navbar.Brand className={styles.headerText}>
                  <b>ReCiter Publication Management System</b>
              </Navbar.Brand>
          </div>
          <div>
          <ul className={`nav navbar-nav ${styles.navbarRight}`}>
              {(session && session.data) ? 
              <>
                  <li className={styles.headerNavSignedInAs}><p><b>Signed in as {session.data.username}</b></p></li> 
                  <li><a className={styles.logout} onClick={()=>{signOut({ callbackUrl: `${window.location.origin}/login` })}}>Logout</a></li>
              </> : null}
              
          </ul>
          </div>
        </Navbar>
    )
}
export default Header;
