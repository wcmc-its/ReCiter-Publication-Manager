import React, { Component } from "react";
import { Navbar, Container} from "react-bootstrap";
import styles from "./Header.module.css";
import { signOut, useSession} from 'next-auth/react';
import { getSigninUrl } from '../../../utils/loginHelper'

const Header = () => {
    const { data: session, status } = useSession()
    const loading = status === "loading"
    return (
        <Navbar bg="primary" className={styles.opNav}>
          <div>
              <Navbar.Brand className={styles.headerText}>
                  <b>ReCiter Publication Manager</b>
              </Navbar.Brand>
          </div>
          <div>
          <ul className={`nav navbar-nav ${styles.navbarRight}`}>
              {(session && session.data) ? 
              <>
                  <li className={styles.headerNavSignedInAs}><p><b>Signed in as {session.data.username}</b></p></li> 
                  <li><a className={styles.logout} onClick={()=>{signOut({ callbackUrl: getSigninUrl() })}}>Logout</a></li>
              </> : null}
              
          </ul>
          </div>
        </Navbar>
    )
}
export default Header;
