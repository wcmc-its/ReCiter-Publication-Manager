import React, { Component } from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import logo from '../../images/Reciter.png';
import "../../css/Header.css";

export default class Header extends Component {
    
    render() {
        return (
            <Navbar bg="default" className="topNav">
                <Navbar.Brand className="pt-1 pb-0 h-100">
                   <img src={logo} width="100%" height="100%"/>
                </Navbar.Brand>
                <Navbar.Text className="pl-5 publication_text"><b> Publication Management System</b></Navbar.Text>
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
