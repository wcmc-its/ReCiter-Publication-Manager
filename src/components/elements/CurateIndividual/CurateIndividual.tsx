import React, { useEffect } from "react";
import { useRouter } from 'next/router';
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { identityFetchData, reciterFetchData } from "../../../redux/actions/actions";
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import { Container, Button } from "react-bootstrap";
import appStyles from '../App/App.module.css';
import styles from "./CurateIndividual.module.css";
import InferredKeywords from "./InferredKeywords"
import SuggestionsBanner from "./SuggestionsBanner";
import ReciterTabs from "./ReciterTabs";

interface PrimaryName {
  firstInitial?: string,
  firstName?: string,
  lastName?: string,
  middleName?: string,
  middleInitial?: string,
}

const CurateIndividual = () => {
  const router = useRouter()
  const { id } = router.query
  const dispatch = useDispatch();
  const identityData = useSelector((state: RootStateOrAny) => state.identityData)
  const identityFetching = useSelector((state: RootStateOrAny) => state.identityFetching)
  const reciterData = useSelector((state: RootStateOrAny) => state.reciterData)
  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)

  useEffect(() => {
    dispatch(identityFetchData(id));
    dispatch(reciterFetchData(id, false));
  }, [])

  const DisplayName = ({ name } : { name: PrimaryName}) => {
    let formattedName = fullName(name);
    return (
      <h2>{formattedName}</h2>
    )
  }

  if (identityFetching || reciterFetching) {
    return (
      <Loader />
    )
  }

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.header}>Curate Publications</h1>
      {
        identityData &&
        <Container className="indentity-data-container">
          <div className="flex-grow-1">
            <DisplayName 
              name={identityData.primaryName}
            />
            <b>{identityData.title}</b>
            <p className={styles.greyText}>{identityData.primaryOrganizationalUnit}</p>
            {reciterData && reciterData.reciter &&
              <InferredKeywords
                reciter={reciterData.reciter}
                />
            }
            <Button className="transparent-btn">View Profile</Button>
          </div>
        </Container>
      }
      { reciterData.reciterPending && reciterData.reciterPending.length > 0 &&
        <SuggestionsBanner
          uid={id}
          count={reciterData.reciterPending.length}
        />
      }
      <ReciterTabs 
        reciterData={reciterData}
        fullName={fullName(identityData.primaryName)}
      />
    </div>
  )
}

export default CurateIndividual;