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
                <Navbar.Text>Publications Management System</Navbar.Text>
                {
                (this.props.username !== undefined && this.props.username.length > 0)?
                (<div className="drop-container">
                    <div className="header-username">
                        {this.props.username}
                    </div>
                    
                    <div className="dropdown">
                        <span className="drop-btn">
                        
                        <svg aria-hidden="true" focusable="false" data-prefix="fal" data-icon="angle-down" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" class="svg-inline--fa fa-angle-down fa-w-8 fa-fw fa-2x"><path fill="currentColor" d="M119.5 326.9L3.5 209.1c-4.7-4.7-4.7-12.3 0-17l7.1-7.1c4.7-4.7 12.3-4.7 17 0L128 287.3l100.4-102.2c4.7-4.7 12.3-4.7 17 0l7.1 7.1c4.7 4.7 4.7 12.3 0 17L136.5 327c-4.7 4.6-12.3 4.6-17-.1z" class=""></path></svg>
                        
                        
                        
                        </span>
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
}
