import React, { Component } from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import Reciter from '../../images/Reciter.png'
import "../../css/Header.css";

export default class Header extends Component {

    render() {
        return (
            <Navbar bg="default" className="topNav">
                <Navbar.Brand>
                  <img src={Reciter} alt='contest-cover' />
                </Navbar.Brand>
                <Navbar.Text>Publications Management System</Navbar.Text>
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
}
