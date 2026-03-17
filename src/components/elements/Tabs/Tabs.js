import React from 'react';
import { useSelector } from "react-redux";
import { Nav } from 'react-bootstrap';
import styles from './Tabs.module.css';

const Tabs = (props) => {

    const reciterData = useSelector((state) => state.reciterData)
    var suggested = 0
    var accepted = 0
    var rejected = 0

    reciterData.reciter.forEach(function(publication){
        switch(publication.userAssertion) {
            case "NULL":
                suggested++
                break
            case "ACCEPTED":
                accepted++
                break
            case "REJECTED":
                rejected++
                break
            default:
                break
        }
    })

    return (
        <Nav variant="tabs" activeKey={props.tabActive} onSelect={(selectedKey) => props.tabClickHandler(selectedKey)} className="tabs-headers">
            <Nav.Item>
                <Nav.Link
                    eventKey="Accepted"
                    className={styles.publicationsTabLink}
                >Accepted <span className={styles.publicationsTabLinkActive}>{accepted}</span></Nav.Link>
            </Nav.Item>
            <Nav.Item>
                <Nav.Link
                    eventKey="Suggested"
                    className={styles.publicationsTabLink}
                >Suggested <span className={styles.publicationsTabLinkActive}>{suggested}</span></Nav.Link>
            </Nav.Item>
            <Nav.Item>
                <Nav.Link
                    eventKey="Rejected"
                    className={styles.publicationsTabLink}
                >Rejected <span className={styles.publicationsTabLinkActive}>{rejected}</span></Nav.Link>
            </Nav.Item>
            <Nav.Item>
                <Nav.Link
                    eventKey="Add Publication"
                    className={styles.publicationsTabLink}
                >Add Publication</Nav.Link>
            </Nav.Item>
        </Nav>
    );
}

export default Tabs
