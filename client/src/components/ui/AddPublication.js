import React, { Component } from 'react';
import '../../css/AddPublication.css';
import '../ManageProfile/ManageProfile.css';
// import Image from 'react-bootstrap/Image';
import checked_icon from '../../images/icons/checked.svg';
import cancel_icon from '../../images/icons/close1.svg';
import { Row, Col, Button, Form, Table, Accordion, Card, Collapse } from 'react-bootstrap';

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

        const { item } = this.props;

        return <div className="addpublicationtablebody tableBody backgroundColorWhite">
                <Table className="mb-1" responsive>
                    <tbody>
                        <tr>
            <td style={{width: "10%"}}>
                <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                    <Button className="pblicationacceptbtn backgroundColorGreen btn-success" onClick={this.acceptPublication}> <span><img src={checked_icon} className='publicationaccepted_icons'/></span> <span className="pblicationacceptbtntext">Accept</span>
                    </Button>
                    <Button className="pblicationrejectbtn backgroundColorRed" onClick={this.rejectPublication}> <span><img src={cancel_icon} className='publicationreject_icons'/></span> <span>Reject</span>
                    </Button>
                </div>
            </td>
            <td style={{width: "90%"}}>
            <Row>
                                    <Col lg={12} className="add-publication_content pt-1">
                <p>
                    <b>Authors: </b>
                    
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
                </p>
                <p>
                    <b>Title: </b>
                    <a class="title_content" href={`https://www.ncbi.nlm.nih.gov/pubmed/${item.pmid}`} target="_blank" rel="noopener noreferrer">{item.title}</a>
                </p>

                <p>
                    <b>Journal: </b>
                    <span class="journal_content">{item.journal}</span>
                </p>
                <p>
                    <b>Date: </b>
                    <span class="date_content">{item.displayDate}</span>
                </p>
                </Col>
                </Row>
            </td>
        </tr>
                    </tbody>

        </Table>
        </div>
                    ;
    }

}

export default AddPublication;
