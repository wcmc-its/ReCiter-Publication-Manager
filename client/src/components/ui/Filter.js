import React, { Component } from 'react';
import '../../css/Filter.css';
import { Dropdown } from './Dropdown';

export class Filter extends Component {

    state = {
        search: "",
        sort: "0"
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
                {(this.props.showSort) ? <Dropdown sort={this.state.sort} onChange={this.handleSortUpdate} /> :
                    <span></span>
                }
                <input
                    type="text"
                    className="form-control"
                    placeholder="Filter..."
                    onKeyUp={this.handleSearchUpdate}
                    ref="filter-form-search"
                />
            </div>
        );
    }

}