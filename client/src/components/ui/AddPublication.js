import React, { Component } from 'react';
import '../../css/AddPublication.css';
import '../ManageProfile/ManageProfile.css';
import Image from 'react-bootstrap/Image'
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

        return <div className="tableBody backgroundColorWhite">
                <Table className="mb-1">
                    <tbody>
                        <tr>
            <td style={{width: "10%"}}>
                <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                    <Button className="backgroundColorGreen btn-success" onClick={this.acceptPublication}> <span className="glyphicon glyphicon-ok margin10 padding10" />
                    Accept
                    </Button>
                    <Button className="backgroundColorRed" onClick={this.rejectPublication}> <span className="glyphicon glyphicon-remove" />
                    Reject
                    </Button>
                </div>
            </td>
            <td style={{width: "90%"}}>
            <Row>
                                    <Col lg={12} className="pt-1">
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
                    {item.title}
                </p>
                <p>
                    <b>Journal: </b>
                    {item.journal}
                </p>
                <p>
                    <b>Date: </b>
                    {item.displayDate}
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