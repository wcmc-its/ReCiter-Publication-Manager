import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import ReactTooltip from 'react-tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/Author';
import { useRouter } from 'next/router';
import { useSelector, RootStateOrAny } from "react-redux";
import Publication from "./Publication";

//TEMP: update to required
interface FuncProps {
    onAccept?(id: number): void,
    onReject?(id: number): void,
    onUndo?(id: number): void,
    item: any,
    faculty?: any,
    key: number,
}

const PublicationsPane: FunctionComponent<FuncProps> = (props) => {

    const [countPendingArticles, setCountPendingArticles] = useState<number>(props.item.countPendingArticles || 0)
    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [displayArticleIndexes, setDisplayArticleIndexes] = useState<number[] | []>(props.item.reCiterArticleFeatures.length > 1 ? [0, 1] : [0])

    const router = useRouter()

    // TODO
    const acceptPublication = ( pmid: number, index: number ) => {

        if ( countPendingArticles > 0 ) {
          setCountPendingArticles(countPendingArticles - 1);
        }
        // props.onAccept(pmid);
        let currArticleIndexes = [...displayArticleIndexes];
        displayArticleIndexes.forEach((pos, i) => {
          if (index === pos) {
            if (displayArticleIndexes.length > 1) {
              let currMax = Math.max(displayArticleIndexes[0], displayArticleIndexes[1]);
              if (currMax === props.item.reCiterArticleFeatures.length - 1) {
                currArticleIndexes.splice(i, 1);
              } else {
                currArticleIndexes.splice(i, 1, currMax + 1);
                currArticleIndexes.sort((a, b) => a - b)
              }
            } else {
              currArticleIndexes = [];
            }
          }
        })
        console.log(currArticleIndexes);
        setDisplayArticleIndexes(currArticleIndexes);
    }

    //TODO
    const rejectPublication = (pmid: number, index: number) => {
      if ( countPendingArticles > 0 ) {
        setCountPendingArticles(countPendingArticles - 1);
      }
      props.onReject(pmid)
    }

    const undoPublication = (pmid: number, index: number) => {
      setCountPendingArticles(countPendingArticles + 1);
      props.onUndo(pmid)
    }

    const handleProfileClick = (uid: string) => {
      return router.push('/app/' + uid)
    }

    const { item } = props;

    return (
      <Container className={`${styles.publicationContainer} p-0`} fluid key={props.key}>
        <Accordion>
         <Accordion.Item eventKey="0">
          <Accordion.Header className={styles.publicationHeader}> 
            <Row>
              <Col md={8} className={styles.facultyHeader}>
                {filteredIdentities[item.personIdentifier] && <p><span className={styles.facultyTitle}>{filteredIdentities[item.personIdentifier].fullName}</span>{filteredIdentities[item.personIdentifier].title}</p>}
              </Col>
              <Col md={3}>
                <div className={styles.publicationRowButtons}>
                  <Button onClick={() => handleProfileClick(item.personIdentifier)}>
                    View Profile
                  </Button>
                  <Button onClick={() => handleProfileClick(item.personIdentifier)}>
                    {`View All ${countPendingArticles} Pending`}
                  </Button>
                </div>
              </Col>
            </Row>
          </Accordion.Header>
          <Accordion.Body> 
          {
            item.reCiterArticleFeatures.length === 0 &&
              <div className="d-flex justify-content-center">
                <p className="text-align-center">No pending publications</p>
              </div>
          }
          {item.reCiterArticleFeatures.length > 0 &&
            displayArticleIndexes.map((pos: number, index: number) => {
              return(
                <Publication
                  key={pos}
                  index={pos}
                  reciterArticle={item.reCiterArticleFeatures[pos]}
                  personIdentifier={item.personIdentifier}
                  onAccept={acceptPublication}
                  fullName={ filteredIdentities[item.personIdentifier] ? filteredIdentities[item.personIdentifier].fullName : ''}
                  />
              )
            })
            }
         </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Container>
  ); 
}

export default PublicationsPane;