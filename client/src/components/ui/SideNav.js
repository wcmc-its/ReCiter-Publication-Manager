import admin from "../../images/icons/admin.png";
import find from "../../images/icons/find.png";
import profile from "../../images/icons/profile.png";
import growth from "../../images/icons/growth.png";
import copy from "../../images/icons/copy.png";
import React, { Component } from "react";
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faOutdent, faBars } from '@fortawesome/free-solid-svg-icons'
import "../../css/SideNav.css";
const mql = global.matchMedia(`(min-width: 768px)`);

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
            return this.props.history.push('/individual')
            // return window.location.href = '/individual'
        }
        if (link !== undefined && link === 'Review Suggestions') {
            // if(window.location.pathname === '/search') {
            //     return this.props.history.push('/search')
            // }
            // return this.props.history.push('/manage/' + this.props.uid)
            return this.props.history.push('/reviewSuggestions')
        }
    }
    getPosition(string, subString, index) {
        return string.split(subString, index).join(subString).length;
    }
    onClick() {
        this.setState({ childVisible: !this.state.childVisible });
    }
    render() {
        console.log(this.props.history.location.pathname, '<=========Path Name')
        let urlpathName = this.props.history.location.pathname
        urlpathName = urlpathName.length <= this.getPosition(urlpathName, '/', 2) ? urlpathName : urlpathName.substr(0, this.getPosition(urlpathName, '/', 2))
        const navItems = [
            { category: "Find Scholar", icon: find, links: [{ name: "Individual", value: "/individual" }] },
            { category: "Manage Publications", icon: copy, links: [{ name: "Review Suggestions", value: "/app" }] },
            { category: "Manage Profile", icon: profile, links: [] },
            { category: "Reports", icon: growth, links: [{ name: "List View", value: "" }, { name: "Export View", value: "" }, { name: "Impact Pictograph", value: "" }, { name: "Impact Table", value: "" }] },
            { category: "Admin", icon: admin, links: [{ name: "Settings", value: "" }, { name: "Control Access", value: "" }, { name: "FAQs", value: "" }] }

        ];
        const listItems = navItems.map((item, index) => (
            <div className="category" key={index}>
                <span className="side_nav_icon icon" style={{ backgroundImage: `url(${item.icon})` }} /> {item.category}
                {item.links.map(link => (
                    <div className="links" key={index}>
                        <a className={`side-nav-element ${(urlpathName === link.value) ? 'side_bar_active' : 'inactive'}`} onClick={() => { this.manageLinks(link.name) }}>{link.name}</a>
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
