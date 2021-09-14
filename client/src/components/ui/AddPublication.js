import React, { Component } from 'react';
import '../../css/AddPublication.css';
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";
import {Error} from "./Error"

class AddPublication extends Component {

    constructor(props) {
        super(props);
        this.acceptPublication = this.acceptPublication.bind(this);
        this.rejectPublication = this.rejectPublication.bind(this);
        this.undoPublication = this.undoPublication.bind(this);
    }

    acceptPublication() {
        const { item } = this.props;
        this.props.onAccept(item.pmid);
    }

    rejectPublication() {
        const { item } = this.props;
        this.props.onReject(item.pmid);
    }

    undoPublication() {
        const { item } = this.props;
        this.props.onUndo(item.pmid);
    }

    render() {
        /* if(this.props.errors && this.props.errors.length > 0) {
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header  username={this.props.username}  />
                    </div>

                    <div className="side-nav-position">
                        <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                    </div>
                    <div>
                        <Error {...this.props} />
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        } */

        const { item } = this.props;

        return <tr>
            <td key="0" className="h6fnhWdeg-publication-buttons">
                <div>
                    <button
                        className={`btn btn-success h6fnhWdeg-publication-accept`}
                        onClick={this.acceptPublication}
                    >Accept
                    </button>
                    <button
                        className={`btn btn-danger h6fnhWdeg-publication-reject`}
                        onClick={this.rejectPublication}
                    >Reject
                    </button>
                </div>
            </td>
            <td key="1" className="h6fnhWdeg-publication-content">
                <p className="h6fnhWdeg-publication-field">
                    <strong>Authors: </strong>
                    <span className="h6fnhWdeg-publication-field-authors">
                        {
                            (item.authors !== undefined)?
                            item.authors.map(function(author, authorIndex) {
                                var authorHTML = <span></span>;

                                authorHTML = <span
                                    key={authorIndex}>{author.authorName}{(authorIndex < item.authors.length - 1) ? ", " : ""}</span>;
                                return authorHTML;
                            })
                            :<span>No authors listed</span>
                        }

                    </span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong>Title: </strong>
                    <span className="h6fnhWdeg-publication-field-title">{item.title}</span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong>Journal: </strong>
                    <span className="h6fnhWdeg-publication-field-journal">{item.journal}</span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong>Date: </strong>
                    <span className="h6fnhWdeg-publication-field-year">{item.displayDate}</span>
                </p>
            </td>
        </tr>;
    }

}

export default AddPublication;