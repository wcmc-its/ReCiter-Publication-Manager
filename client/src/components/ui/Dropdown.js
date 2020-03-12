import React, { Component } from 'react';
import '../../css/Dropdown.css';

export class Dropdown extends Component {

    state = {
        isOpen: false,
        sort: "0"
    };

    constructor(props) {
        super(props);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.state.sort = this.props.sort;
    }

    toggleOpen(event) {
        event.stopPropagation();
        this.setState({ isOpen: !this.state.isOpen });
    }

    handleClick(event, sortBy) {
        event.stopPropagation();
        var sortValue = "0";
        switch(this.state.sort) {
            case "0":
                if(sortBy === "Score") {
                    sortValue = "1";
                }else {
                    sortValue = "2";
                }
                break;
            case "1":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "2";
                }
                break;
            case "2":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "3";
                }
                break;
            case "3":
                if(sortBy === "Score") {
                    sortValue = "0";
                }else {
                    sortValue = "2";
                }
                break;
            default:
                sortValue = "0";
        }
        this.setState({
            isOpen: false,
            sort: sortValue
        })
        this.props.onChange(sortValue);
    }

    render() {
        var sortClass = "";
        var sortBy = " ";
        switch(this.state.sort) {
            case "0":
                sortClass = "dropdown-sort-desc";
                sortBy = "Score";
                break;
            case "1":
                sortClass = "dropdown-sort-asc";
                sortBy = "Score";
                break;
            case "2":
                sortClass = "dropdown-sort-desc";
                sortBy = "Year";
                break;
            case "3":
                sortClass = "dropdown-sort-asc";
                sortBy = "Year";
                break;
            default:
                sortClass = "dropdown-sort-desc";
                sortBy = "Score";
                break;
        }

        return (
            <div className="dropdown" onClick={this.toggleOpen}>
                <button
                    className="btn btn-primary dropdown-toggle"
                    type="button"
                    id="dropdownMenuButton"
                    data-toggle="dropdown"
                    aria-haspopup="true"
                >
                    Sort by <span className={sortClass}>{sortBy}</span>
                </button>
                <div className={`dropdown-menu dropdown-menu-right ${this.state.isOpen ? " show" : ""}`} aria-labelledby="dropdownMenuButton">
                    <span
                        className={(sortBy === "Score")?sortClass:""}
                        onClick={(event) => this.handleClick(event, "Score")}
                    >Score</span>
                    <span
                        className={(sortBy === "Year")?sortClass:""}
                        onClick={(event) => this.handleClick(event, "Year")}
                    >Year</span>
                </div>
            </div>
        );
    }
}