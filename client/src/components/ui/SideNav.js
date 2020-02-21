import React, { Component } from "react";
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faOutdent, faBars } from '@fortawesome/free-solid-svg-icons'
import "../../css/SideNav.css";
const mql = global.matchMedia(`(min-width: 768px)`);
import admin from "../../images/icons/admin.png";
import find from "../../images/icons/find.png";
import profile from "../../images/icons/profile.png";
import growth from "../../images/icons/growth.png";
import copy from "../../images/icons/copy.png";

export default class SideNav extends Component {

    constructor(props) {
        super(props)
        this.state = {
            childVisible: false
        }
        // bind elements
        this.manageLinks = this.manageLinks.bind(this)
    }

    manageLinks(link) {
        if (link !== undefined && link === 'Individual') {
            // return this.props.history.push('/search')
            return window.location.href = '/individual'
        }
        if (link !== undefined && link === 'Review Suggestions') {
            // if(window.location.pathname === '/search') {
            //     return this.props.history.push('/search')
            // }
            // return this.props.history.push('/manage/' + this.props.uid)
            return window.location.href = '/reviewSuggestions'
            // return this.props.history.push('/reviewSuggestions')
        }
    }

    onClick() {
        this.setState({ childVisible: !this.state.childVisible });
    }
    render() {
        const navItems = [
            { category: "Find Scholar", icon: find, links: ["Individual"] },
            { category: "Manage Publications", icon: copy, links: ["Review Suggestions"] },
            { category: "Manage Profile", icon: profile, links: [] },
            { category: "Reports", icon: growth, links: ["List View","Export View","Impact Pictograph","Impact Table"] },
            { category: "Admin", icon: admin, links: ["Settings","Control Access","FAQs"] },
        ];
        const listItems = navItems.map((item, index) => (
            <div className="category" key={index}>
                <span className="icon" style={{backgroundImage: `url(${item.icon})`}}/> {item.category}
                {item.links.map(link => (
                    <div className="links" key={index}>
                        <a onClick={() => { this.manageLinks(link) }}>{link}</a>
                    </div>
                ))}
                <hr className="navHr" />
            </div>
        ));
        return <div>
            <div className="desktop_side_bar">
                <div className="sideNav">{listItems}</div>
            </div>
            <div className="mobile_side_bar">
                {
                    this.state.childVisible ? <div className="sideNav">{listItems}</div> : null}
            </div>
            <div onClick={this.onClick.bind(this)}>
                <Button variant="primary" className="sideNav_tooglt_btn">{
                    this.state.childVisible ? <FontAwesomeIcon icon={faOutdent} size='1x' /> : <FontAwesomeIcon icon={faBars} size='1x' />}</Button>
            </div> </div>;
    }
}
