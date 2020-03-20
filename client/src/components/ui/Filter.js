import React, { Component } from 'react';
import '../../css/Filter.css';
import { Dropdown } from './Dropdown';

export class Filter extends Component {

    state = {
        search: "",
        sort: "0",
    }

    constructor(props) {
        super(props);
        this.handleSearchUpdate = this.handleSearchUpdate.bind(this);
        this.handleSortUpdate = this.handleSortUpdate.bind(this);
    }

    handleSearchUpdate(event) {
        this.setState({ search: event.target.value }, () => {
            this.onFilterUpdate();
        });
    }

    handleSortUpdate(sortValue) {
        this.setState({ sort: sortValue }, () => {
            this.onFilterUpdate();
        });
    }

    onFilterUpdate() {
        this.props.onChange(this.state);
    }

    render() {

        return (
            <div className="filter-container" key="filter-component">
                <input
                    type="text"
                    className="form-control"
                    placeholder="Filter........"
                    onKeyUp={this.handleSearchUpdate}
                    ref="filter-form-search"
                />
                {(this.props.showSort) ? <Dropdown id="dropdown-basic" sort={this.state.sort} onChange={this.handleSortUpdate} /> :
                    <span></span>
                }
                <select className="sort_filter_select form-control">
                    <option value="50">50</option>
                    <option value="20">20</option>
                    <option value="10">10</option>
                </select>
                <span class="selectdivider divider"></span>
            </div>
        );
    }
}