import React from "react";
import { Row, Alert, Button, Container } from "react-bootstrap";
import styles from "./CurateIndividual.module.css";
import { useDispatch } from "react-redux";
import { reciterFetchData } from "../../../redux/actions/actions";

const SuggestionsBanner = ({ uid, count } : { uid : string | string[], count: number}) => {
  const dispatch = useDispatch();

  const refreshSuggestions = () => {
    dispatch(reciterFetchData(uid, true));
  }
 
  return (
    <>
    <Container fluid className={`${styles.suggestionsBanner} my-2 p-1`}>
      <Alert variant="warning" className="mt-3">{`You have provided feedback on ${count} record(s). `}</Alert>
      <Button className="wcm-primary-lg" onClick={refreshSuggestions}>Refresh Suggestions</Button>
    </Container>
    </>
  )
}

export default SuggestionsBanner;