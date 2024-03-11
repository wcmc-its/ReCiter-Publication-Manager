import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from 'next/router';
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { identityFetchData, reciterFetchData,reCalcPubMedPubCount, fetchFeedbacklog } from "../../../redux/actions/actions";
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import { Container, Button, Row,Toast } from "react-bootstrap";
import appStyles from '../App/App.module.css';
import styles from "./CurateIndividual.module.css";
import InferredKeywords from "./InferredKeywords"
import SuggestionsBanner from "./SuggestionsBanner";
import ReciterTabs from "./ReciterTabs";
import Image from "next/image";
import Profile from "../Profile/Profile";
import { useSession } from "next-auth/react";
import { allowedPermissions, toastMessage } from "../../../utils/constants";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";
import { reciterConfig } from "../../../../config/local";



interface PrimaryName {
  firstInitial?: string,
  firstName?: string,
  lastName?: string,
  middleName?: string,
  middleInitial?: string,
}

const CurateIndividual = () => {
  const router = useRouter()
  const  {id}  = router.query;
  const [newId, setNewId ] = useState<any>();
  const dispatch = useDispatch();
  const identityData = useSelector((state: RootStateOrAny) => state.identityData)
  const identityFetching = useSelector((state: RootStateOrAny) => state.identityFetching)
  const reciterData = useSelector((state: RootStateOrAny) => state.reciterData)
  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)
  const [displayImage, setDisplayImage] = useState<boolean>(true);
  const [modalShow, setModalShow] = useState(false);
  const {data: session, status} = useSession();
  const loading = status === "loading"
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  const [isLoading, setLoading] = useState(false);
  const [headShot, setHeadShot] = useState<any>([])


  useEffect(() => {
    let userPermissions = JSON.parse(session.data?.userRoles);
    if(!id)
	{
		return;
	}
    fetchAllAdminSettings();
    let nextPersonIdentifier = "";
     setNewId(id);
     dispatch(identityFetchData(id));
     fetchData();
  }, [id])

  const fetchData = () => {
    dispatch(reciterFetchData(id, false));
    dispatch(fetchFeedbacklog(id));
  }

  const fetchAllAdminSettings = () => {
    setLoading(true);
    const request = {};
    fetch(`/api/db/admin/settings`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(request),
    }).then(response => response.json())
      .then(data => {
        let parsedSettingsArray = [];
        data.map((obj, index1) => {
          let a = JSON.stringify(obj.viewAttributes)
          let b = JSON.parse(a);
          let c = typeof(b) === "string" ? JSON.parse(b) : b
          let parsedSettings = {
            viewName : obj.viewName,
            viewAttributes: c,
            viewLabel: obj.viewLabel
          }
          parsedSettingsArray.push(parsedSettings)
        })
        var viewAttributes = [];
        var headShotViewAttributes = [];

        let updatedData = parsedSettingsArray.find(obj => obj.viewName === "viewProfile")
        let headShotData = parsedSettingsArray.find(obj => obj.viewName === "headshot")

        viewAttributes = updatedData.viewAttributes;
        headShotViewAttributes = headShotData.viewAttributes
        setViewProfileLabels(viewAttributes)
        setHeadShot(headShotViewAttributes)
      })
      .catch(error => {
        // setLoading(false);
      });
  }

  const DisplayName = ({ name }: { name: PrimaryName }) => {
    let formattedName = fullName(name);
    return (
      <h2 className="mb-1">{formattedName}</h2>
    )
  }

  const handleClose = () => setModalShow(false);
  const handleShow = () => setModalShow(true);

  if (identityFetching || reciterFetching) {
    return (
      <Loader />
    )
  }

  return (
      <div className={appStyles.mainContainer}>
       <ToastContainerWrapper />
        <h1 className={styles.header}>Curate Publications</h1>
        {
          identityData &&
          <Container className={styles.indentityDataContainer} fluid={true}>
            <div className="d-flex">
              {
                displayImage && identityData.identityImageEndpoint && headShot && headShot.length > 0 && headShot[0].isVisible &&
                <div className={styles.profileImgWrapper}>
                  <Image
                    src={headShot.length > 0 && headShot[0]?.syntax?.replace("{personIdentifier}", identityData.uid)}
                    alt="Profile photo"
                    width={144}
                    height={217}
                    onError={() => setDisplayImage(false)}
                  />
                </div>
              }
              <div className="flex-grow-1">
                <DisplayName
                  name={identityData.primaryName}
                />
                <b>{identityData.title}</b>
                <p className={`${styles.greyText} mb-1`}>{identityData.primaryOrganizationalUnit}</p>
                {reciterData && reciterData.reciter &&
                  <InferredKeywords
                    reciter={reciterData.reciter}
                  />
                }
                <Button className="transparent-btn mx-0" onClick={handleShow}>View Profile</Button>
              </div>
            </div>
          </Container>
        }

      {reciterData.reciterPending && reciterData.reciterPending.length > 0 &&
        <SuggestionsBanner
          uid={newId}
          count={reciterData.reciterPending.length}
        />
      }

      <ReciterTabs
        reciterData={reciterData}
        fullName={fullName(identityData.primaryName)}
        fetchOriginalData={fetchData}
      />
      <Profile
        uid={identityData.uid}
        modalShow={modalShow}
        handleShow={handleShow}
        handleClose={handleClose}
        viewProfileLabels={viewProfileLabels}
        headShotLabelData = {headShot}
      />
    </div>
  )
}

export default CurateIndividual;