import React, { Component } from "react";
import { Navbar} from "react-bootstrap";
import styles from "./Header.module.css";
import { useSelector } from 'react-redux';

type Props = {
    username: string
}

const Header: React.FC<Props> = () => {
    const username = useSelector((state: any) => state.auth.username)
    return (
        <Navbar bg="primary" className={styles.topNav}>
            <div>
                <Navbar.Brand className={styles.headerText}>
                    <b>ReCiter Publication Management System</b>
                </Navbar.Brand>
            </div>
            <div>
            <ul className={`nav navbar-nav ${styles.navbarRight}`}>
                {username !== undefined && username.length > 0 ? 
                <>
                    <li className={styles.headerNavSignedInAs}><p><b>Signed in as {username}</b></p></li> 
                    <li><a className={styles.logout} href="/logout">Logout</a></li>
                </> : null}
                
            </ul>
            </div>
        </Navbar>
    )
}
export default Header;
