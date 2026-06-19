import React, { Component } from "react";
import { Navbar, Container} from "react-bootstrap";
import styles from "./Header.module.css";
import { signOut, useSession} from 'next-auth/react';
import { getSigninUrl } from '../../../utils/loginHelper'

const Header = () => {
    const { data: session, status } = useSession(); const loading = status === "loading"
    return (
        <Navbar bg="primary" className={styles.topNav}>
          <div>
              <Navbar.Brand className={styles.headerText}>
                  <span className={styles.brandDot}></span>
                  <b>ReCiter Publication Manager</b>
              </Navbar.Brand>
          </div>
          <div>
          <ul className={`nav navbar-nav ${styles.navbarRight}`}>
              {(session && session.data) ? 
              <>
                  <li className={styles.headerNavSignedInAs}><p>{session.data.username}</p></li>
                  <li><a className={styles.logout} onClick={()=>{signOut({ callbackUrl: getSigninUrl() })}}>Logout</a></li>
              </> : null}
              
          </ul>
          </div>
        </Navbar>
    )
}
export default Header;
