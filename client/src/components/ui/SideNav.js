import { faBars, faOutdent } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { Component } from "react";
import "../../css/SideNav.css";
import admin from "../../images/icons/admin.png";
import copy from "../../images/icons/copy.png";
import find from "../../images/icons/find.png";
import growth from "../../images/icons/growth.png";
import profile from "../../images/icons/profile.png";
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
        }
        if (link !== undefined && link === 'Review Suggestions') {
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
        let urlpathName = this.props.history.location.pathname
        urlpathName = urlpathName.length <= this.getPosition(urlpathName, '/', 2) ? urlpathName : urlpathName.substr(0, this.getPosition(urlpathName, '/', 2))
        let myobj = {
            '/individual' : 'Individual',
            '/app': 'Review suggestions',
            '/search': 'Individual',
            '/review_suggestions': 'Review suggestions'
        }
        const navItems = [
            { category: "Find scholar", icon: find, links: [{ name: "Individual", value: "/individual" }] },
            { category: "Manage publications", icon: copy, links: [{ name: "Review suggestions", value: "/app" },{ name: "Curate Ppblications", value: "/" }] },
            { category: "Manage profile", icon: profile, links: [] },
            { category: "Reports", icon: growth, links: [{ name: "List view", value: "" }, { name: "Export view", value: "" }, { name: "Impact pictograph", value: "" }, { name: "Impact table", value: "" }] },
            { category: "Admin", icon: admin, links: [{ name: "Settings", value: "" }, { name: "Control access", value: "" }, { name: "FAQs", value: "" }] }

        ];
        const listItems = navItems.map((item, index) => (
            <div className="category" key={index}>
                <span className="side_nav_icon icon" style={{ backgroundImage: `url(${item.icon})` }} /> 
                <div className="side_nav_category">{item.category}</div>
                {item.links.map(link => (
                    <div className="links" key={index}>
                        <a className={`side-nav-element ${(myobj[urlpathName] === link.name) ? 'side_bar_active' : 'inactive'}`} onClick={() => { this.manageLinks(link.name) }}>{link.name}</a>
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
            <div className="sideNav_tooglt_btn_pos" onClick={this.onClick.bind(this)}>
            {/*<Button className="sideNav_tooglt_btn">{
                    this.state.childVisible ? <FontAwesomeIcon icon={faOutdent} size='1x' className="sidenavoutdenticon"/> : <FontAwesomeIcon icon={faBars} size='1x' />}
            </Button>*/}

            {
                    this.state.childVisible ? <span className="sideNav_tooglt_btn"><FontAwesomeIcon icon={faOutdent} size='1x' className="sideNav_outdentIcon"/></span> : <span className="sideNav_tooglt_btn"><FontAwesomeIcon icon={faBars} size='1x' /></span>
                    
            }
            
            
            </div> </div>;
    }
}
