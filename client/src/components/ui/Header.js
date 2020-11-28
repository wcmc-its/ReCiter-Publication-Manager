import React, { Component } from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import Reciter from '../../images/Reciter.png'
import "../../css/Header.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleDown } from '@fortawesome/free-solid-svg-icons'

export default class Header extends Component {

    render() {
        return (
            <Navbar className="topNav">
                {<Navbar.Brand>
                    ReCiter
                </Navbar.Brand>}
                <Navbar.Text>Publication Manager</Navbar.Text>
                {
                (this.props.username !== undefined && this.props.username.length > 0)?
                (<div className="drop-container">
                    <div className="header-username">
                       <span class="welcome-statement">Welcome, </span> 
                       <span class="welcome-username">{this.props.username}</span>
                       <a class="header-logout" href="/logout">Log out</a>
                    </div>
                </div>)
                : null
                }
            </Navbar>
        );
    }
}
