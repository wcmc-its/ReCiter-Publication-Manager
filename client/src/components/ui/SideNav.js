import React, { Component } from "react";
import "../../css/SideNav.css";

export default class SideNav extends Component {

    constructor(props) {
        super(props)

        // bind elements
        this.manageLinks = this.manageLinks.bind(this)
    }

    manageLinks(link) {
        if(link !== undefined && link === 'Individual'){
            return this.props.history.push('/search')
        }
        if(link !== undefined && link === 'Review Suggestions'){
            if(window.location.pathname === '/search') {
                return this.props.history.push('/search')
            }
            return this.props.history.push('/manage/' + this.props.uid)
        }
    }


    render() {
        const navItems = [
            { category: "Find Scholar", links: ["Individual"] },
            { category: "Manage Publications", links: ["Review Suggestions"] },
            {
                category: "Manage Profile",
                links: []
            }
        ];
        const listItems = navItems.map((item, index) => (
            <div className="category" key= {index}>
                {item.category}
                {item.links.map(link => (
                    <div className="links" key= {index}>
                        <a onClick={() =>{this.manageLinks(link)}}>{link}</a>
                    </div>
                ))}
                <hr className="navHr" />
            </div>
        ));
        return <div className="sideNav">{listItems}</div>;
    }
}
