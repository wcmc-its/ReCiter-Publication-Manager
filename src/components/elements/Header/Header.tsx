import React from "react";
import { Navbar} from "react-bootstrap";
import styles from "./Header.module.css";
import { signOut, useSession } from "next-auth/react";
import { getSigninUrl } from '../../../utils/loginHelper'

const Header = () => {
    const { data: session } = useSession();
    return (
        <Navbar bg="primary" className={styles.topNav}>
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
