import React, { useState, FunctionComponent, MouseEvent } from "react"
import styles from './Publication.module.css';
import ReactTooltip from 'react-tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card, ButtonProps } from "react-bootstrap";
import type { Author } from '../../../../types/Author';
import { useRouter } from 'next/router';
import { useSelector, RootStateOrAny } from "react-redux";
import Publication from "./Publication";
import { reciterConfig } from "../../../../config/local";
import Divider from "../Common/Divider";
import Profile from "../Profile/Profile";
import { useSession } from "next-auth/client";
import { useDispatch } from "react-redux";
import { reciterUpdatePublicationGroup } from "../../../redux/actions/actions"; 

//TEMP: update to required
interface FuncProps {
    onAccept?(id: number): void,
    onReject?(id: number): void,
    onUndo?(id: number): void,
    item: any,
    faculty?: any,
    key: number,
    index: number,
    feedbacklogGroup: any,
}

const PublicationsPane: FunctionComponent<FuncProps> = (props) => {

    const [countPendingArticles, setCountPendingArticles] = useState<number>(props.item.countPendingArticles || 0)
    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [articles, setArticles] = useState<any[]>(props.item.reCiterArticleFeatures)
    const [modalShow, setModalShow] = useState(false);
    const [session, loading] = useSession();
    const dispatch = useDispatch();
    const feedbacklog = props.feedbacklogGroup.find(feedback => feedback.hasOwnProperty(props.item.personIdentifier)) || {};

    const router = useRouter()

    const maxArticlesPerPerson = reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams.maxArticlesPerPerson;

    // TODO
    const acceptPublication = ( pmid: number, index: number ) => {

        if ( countPendingArticles > 0 ) {
          setCountPendingArticles(countPendingArticles - 1);
        }
        // props.onAccept(pmid);
        let updatedArticlesList = articles.filter((article) => { article.pmid !== pmid});
        setArticles(updatedArticlesList);
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

    const handleUpdatePublication = (uid: string, pmid: number, userAssertion: string) => {
      const userId = session?.data?.databaseUser?.userID;
      const request = {
        publications: [pmid],
        userAssertion: userAssertion,
        manuallyAddedFlag: false,
        userID: userId,
        personIdentifier: uid,
      }

      // Update count
      if ( countPendingArticles > 0 ) {
        setCountPendingArticles(countPendingArticles - 1);
      }

      dispatch(reciterUpdatePublicationGroup(uid, request));
      // Remove publication from the pane
      let updatedArticles = articles.filter(article => article.pmid !== pmid);

      setArticles(updatedArticles);
    }

    const handleProfileClick = (uid: string, event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      return router.push('/curate/' + uid);
    }

    const filterByPmid = (articles, reciterPendingData) => {
      if (reciterPendingData && reciterPendingData.length) {
        let filteredArticles = articles.filter(article => !reciterPendingData.includes(article.pmid));

        return filteredArticles;
      } else {
        return articles;
      } 
    }

    const handleClose = () => setModalShow(false);
    const handleShow = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setModalShow(true);
    };

    const { item } = props;

    return (
      <Container className={`${styles.publicationContainer} p-0`} fluid key={props.key}>
        <Accordion defaultActiveKey={props.index === 0 ? "0" : "1"}>
         <Accordion.Item eventKey="0">
          <Accordion.Header className={styles.publicationHeader}> 
            <Row>
              <Col md={8} className={styles.facultyHeader}>
                {filteredIdentities[item.personIdentifier] && <p><span className={styles.facultyTitle}>{filteredIdentities[item.personIdentifier].fullName}</span>{filteredIdentities[item.personIdentifier].title}</p>}
              </Col>
              <Col md={3}>
                <div className={styles.publicationRowButtons}>
                  <Button onClick={(e) => handleShow(e)}>
                    View Profile
                  </Button>
                  <Button onClick={(e) => handleProfileClick(item.personIdentifier, e)}>
                    {`View All ${countPendingArticles} Pending`}
                  </Button>
                </div>
              </Col>
            </Row>
          </Accordion.Header>
          <Accordion.Body> 
          {
            (item.reCiterArticleFeatures?.length === 0 || countPendingArticles === 0) &&
              <div className="d-flex justify-content-center">
                <p className="text-align-center">No pending publications</p>
              </div>
          }
          {articles.length > 0 &&
            filterByPmid(articles, item.reciterPendingData).map((article: any, index: number) => {
              return(
                <div key={article.pmid || index}>
                  <Publication
                    index={index}
                    reciterArticle={article}
                    personIdentifier={item.personIdentifier}
                    onAccept={acceptPublication}
                    fullName={filteredIdentities[item.personIdentifier] ? filteredIdentities[item.personIdentifier].fullName : ''}
                    feedbacklog={feedbacklog[item.personIdentifier] ? feedbacklog[item.personIdentifier] : {}}
                    updatePublication={handleUpdatePublication}
                    />
                    {index < articles.length - 1 && <Divider></Divider>}
                </div>
              )
            })
            }
            {
              countPendingArticles > maxArticlesPerPerson && 
              <Row>
                <Divider></Divider>
                <div className={`d-flex justify-content-center ${styles.publicationRowButtons}`}>
                  <Button onClick={(e) => handleProfileClick(item.personIdentifier, e)}>View All</Button>
                </div>
              </Row>
            }
         </Accordion.Body>
        </Accordion.Item>
      </Accordion>
      <Profile 
        uid={item.personIdentifier}
        modalShow={modalShow}
        handleShow={handleShow}
        handleClose={handleClose}
      />
    </Container>
  ); 
}

export default PublicationsPane;