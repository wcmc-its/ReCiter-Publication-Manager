import React, { Component } from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import "../../css/Header.css";

export default class Header extends Component {

    render() {
        return (
            <Navbar bg="primary" className="topNav">
                {/*<Navbar.Brand>
                    Re<b>Citer</b>
                </Navbar.Brand>*/}
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
