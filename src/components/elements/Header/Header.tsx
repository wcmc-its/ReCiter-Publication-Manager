import React, { Component } from "react";
import { Navbar} from "react-bootstrap";
import styles from "./Header.module.css";

/* export default class Header extends Component {
    
    render() {
        return (
            <Navbar bg="primary" className="topNav">
                <Navbar.Brand>
                    Re<b>Citer</b>
                </Navbar.Brand>
                <Navbar.Text>Publication Management System</Navbar.Text>
                {
                (this.props.username !== undefined && this.props.username.length > 0)?
                (<div className="drop-container">
                    {this.props.username}
                    <div className="dropdown">
                        <button className="drop-btn">▼</button>
                        <div className="dropdown-content">
                            <a href="/logout">Log out</a>
                        </div>
                    </div>
                </div>)
                : null
                }
            </Navbar>
        );
    }
} */

type Props = {
    username: string
}

const Header: React.FC<Props> = ({ username}) => {
    return (
        <Navbar bg="primary" className={styles.topNav}>
            <Navbar.Brand>
                Re<b>Citer</b>
            </Navbar.Brand>
            <Navbar.Text>Publication Management System</Navbar.Text>
            {
            (username !== undefined && username.length > 0)?
            (<div className={styles.dropContainer}>
                {username}
                <div className={styles.dropdown}>
                    <button className={styles.dropdown}>▼</button>
                    <div className={styles.dropdownContent}>
                        <a href="/logout">Log out</a>
                    </div>
                </div>
            </div>)
            : null
            }
        </Navbar>
    )
}
export default Header;
