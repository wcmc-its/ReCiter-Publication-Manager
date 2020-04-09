import React, { Component } from "react";
import '../../css/Error.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faRedo} from '@fortawesome/free-solid-svg-icons'

export default class Error extends Component {

	constructor(props) {
        super(props)
    }

    render() {
    	return (
    		<div className=" px-auto mx-auto w-50 mt-4">
    		<div className="alert alert-danger" role="alert">
    		{ this.props.errorMessage ? (<div>{this.props.errorMessage}</div>) : (<div>Something is not right!</div>) }
    		Click <span  className="refreshIcon" onClick={() => window.location.reload()}     ><FontAwesomeIcon  icon={faRedo} size='1x' /> </span>to reload
    		</div>	
    		</div>
    		);
    }
}