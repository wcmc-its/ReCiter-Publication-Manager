import React from "react";
import { Button, Container } from "react-bootstrap";
import styles from "./CurateIndividual.module.css";
import { useDispatch } from "react-redux";
import { reciterFetchData } from "../../../redux/actions/actions";
import AutorenewIcon from '@mui/icons-material/Autorenew';

const SuggestionsBanner = ({ uid, count } : { uid : string | string[], count: number}) => {
  const dispatch = useDispatch();

  const refreshSuggestions = () => {
    dispatch(reciterFetchData(uid, true));
  }
 
  return (
    <>
    <Container fluid className={`${styles.suggestionsBanner} my-2 p-1`}>
      <Button className="wcm-primary-lg" onClick={refreshSuggestions}>Refresh Suggestions <AutorenewIcon /></Button>
      <span className="mx-4">{`You have provided feedback on`} <b>{count}</b> {`record(s). `}</span>
    </Container>
    </>
  )
}

export default SuggestionsBanner;