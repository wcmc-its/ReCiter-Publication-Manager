import React, { Component } from 'react';
import '../../css/Dropdown.css';

export class Dropdown extends Component {

    container = React.createRef()
    state = {
        isOpen: false,
        sort: "0",
        sortByValue: 'Year'
    };

    constructor(props) {
        super(props);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.state.sort = this.props.sort;
    }
    componentDidMount() {
        document.addEventListener("mousedown", this.handleClickOutside);
    }
    componentWillUnmount() {
        document.removeEventListener("mousedown", this.handleClickOutside);
    }
    handleClickOutside = event => {
        if (this.container.current && !this.container.current.contains(event.target)) {
            this.setState({
                isOpen: false,
            });
        }
    };
    toggleOpen(event) {
        event.stopPropagation();
        this.setState({ isOpen: !this.state.isOpen });
    }

    handleClick(event, sortBy) {
        event.stopPropagation();
        var sortValue = "0";
        let dropdownValue;
        if (sortBy == 'Year') {
            dropdownValue = 'Score'
        }
        if (sortBy == 'Score') {
            dropdownValue = 'Year'
        }
        switch (this.state.sort) {
            case "0":
                if (sortBy === "Score") {
                    sortValue = "1";
                } else {
                    sortValue = "2";
                }
                break;
            case "1":
                if (sortBy === "Score") {
                    sortValue = "0";
                } else {
                    sortValue = "2";
                }
                break;
            case "2":
                if (sortBy === "Score") {
                    sortValue = "0";
                } else {
                    sortValue = "3";
                }
                break;
            case "3":
                if (sortBy === "Score") {
                    sortValue = "0";
                } else {
                    sortValue = "2";
                }
                break;
            default:
                sortValue = "0";
        }
        this.setState({
            isOpen: false,
            sort: sortValue,
            sortByValue: dropdownValue
        })
        this.props.onChange(sortValue);
    }

    render() {
        var sortClass = "";
        var sortBy = " ";
        switch (this.state.sort) {
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
            <div className="dropdown" onClick={this.toggleOpen} ref={this.container}>
                <button
                    className="btn btn-primary dropdown-toggle"
                    type="button"
                    id="dropdownMenuButton"
                    data-toggle="dropdown"
                    aria-haspopup="true"
                >
                    Sort by <span className={sortClass}><sapn className="drop_down_options">{sortBy}</sapn></span>
                </button>
                <div className={`dropdown-menu dropdown-menu-right ${this.state.isOpen ? " show" : ""}`} aria-labelledby="dropdownMenuButton">
                    <span
                        className={(sortBy === this.state.sortByValue) ? sortClass : ""}
                        onClick={(event) => this.handleClick(event, this.state.sortByValue)}
                    >{this.state.sortByValue}</span>
                </div>
            </div>
        );
    }
}