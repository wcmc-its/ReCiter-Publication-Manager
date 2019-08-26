import React, { Component } from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import "../../css/Header.css";

export default class Header extends Component {
    
    render() {
        return (
            <Navbar bg="primary" className="topNav">
                <Navbar.Brand>
                    Re<b>Citer</b>
                </Navbar.Brand>
                <Navbar.Text>Publication Management System</Navbar.Text>

                <div className="drop-container">
                    {this.props.username}
                    <div className="dropdown">
                        <button className="drop-btn">▼</button>
                        <div className="dropdown-content">
                            <a href="/logout">Log out</a>
                        </div>
                    </div>
                </div>
            </Navbar>
        );
    }
}
