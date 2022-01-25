import React from "react";
import { Row } from "react-bootstrap";
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
    <Row className={`${styles.suggestionsBanner} my-2`}>
      <p>{`You have provided feedback on ${count} record(s). `}<span className="text-btn" onClick={refreshSuggestions}>Refresh</span> suggestions</p>
    </Row>
    </>
  )
}

export default SuggestionsBanner;