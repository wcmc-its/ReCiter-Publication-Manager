import React, { useState, useEffect, useRef } from "react";
import appStyles from './App.module.css';
import { useSelector, useDispatch } from "react-redux";
import { identityFetchData, reciterFetchData } from '../../../redux/actions/actions'
import Tabs from '../Tabs/Tabs'
import TabAccepted from '../TabAccepted/TabAccepted';
import TabSuggested from '../TabSuggested/TabSuggested';
import TabRejected from '../TabRejected/TabRejected';
import TabAddPublication from '../TabAddPublication/TabAddPublication';
import Identity from "../Identity/Identity";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";
import { useSession } from "next-auth/react"
import { getCapabilities } from "../../../utils/constants"

const App = (props) => {

    const dispatch = useDispatch()

    const reciterFetching = useSelector((state) => state.reciterFetching)
    const reciterData = useSelector((state) => state.reciterData)
    const identityStateData = useSelector((state) => state.identityData)
    const identityFetching = useSelector((state) => state.identityFetching)
    const errors = useSelector((state) => state.errors)
    const auth = useSelector((state) => state.auth)

    const [tabActive, setTabActive] = useState("Suggested")
    const [identityData, setIdentityData] = useState({})
    // #873: was `getSession()` -- an unawaited Promise, so session.data was always
    // undefined and the fetch below never fired for anyone. useSession() is the hook
    // Search.js and CurateIndividual.tsx already use for client-side session data.
    const { data: session } = useSession()

    useEffect(() => {
        // Self-service faculty view (Curator_Self), or an admin previewing a record
        // (Curator_All). userRoles is a JSON string, not an array -- same parse the
        // rest of the app does (Search.js:41, CurateIndividual.tsx:59).
        const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : []
        const caps = getCapabilities(userRoles)
        if (caps.canCurate.self || caps.canCurate.all)
         {
            dispatch(reciterFetchData(props.uid, false))
            dispatch(identityFetchData(props.uid))
         }
    },[session])

    const tabClickHandler = (str = 'Suggested') => {
       setTabActive(str)
    }

    const refreshHandler = event => {
        event.preventDefault()
        dispatch(reciterFetchData(props.uid, true))
    }

    if (reciterFetching) {
        return (
            <div className={appStyles.tabContainer}>
                <div className={appStyles.appLoader}> </div>
            </div>
        );
    } else {
        var tabActiveContent = (
            <TabSuggested tabClickHandler={tabClickHandler} />
        );
        switch (tabActive) {
            case "Accepted":
                tabActiveContent = (
                    <TabAccepted tabClickHandler={tabClickHandler} />
                );
                break;
            case "Suggested":
                tabActiveContent = (
                    <TabSuggested tabClickHandler={tabClickHandler} />
                );
                break;
            case "Rejected":
                tabActiveContent = (
                    <TabRejected tabClickHandler={tabClickHandler} />
                );
                break;
            case "Add Publication":
                tabActiveContent = <TabAddPublication />;
                break;
            default:
                tabActiveContent = (
                    <TabSuggested
                        tabClickHandler={tabClickHandler}
                    />
                );
        }
        return (
            <div className={appStyles.publicationsContent}>
                <div className={appStyles.identityContainer}>
                    <Identity
                        identityData={identityStateData}
                        identityFetching={identityFetching}
                        history={history}
                        uid={props.uid}
                        buttonName='Manage Profile'
                    />
                </div>
                <div className={appStyles.tabContainer}>
                    {reciterData?.reciterPending?.length > 0 ? (
                        <div className={appStyles.reciterPendingBanner}>
                            <span>You have provided feedback on </span>
                            <strong>{`${
                                reciterData.reciterPending.length
                                } record(s). `}</strong>
                            <a href="#" onClick={refreshHandler}>
                                Refresh
                            </a>
                            <span> to get new suggestions.</span>
                        </div>
                    ) : null}
                    <Tabs
                        tabActive={tabActive}
                        tabClickHandler={tabClickHandler}
                    />
                    <div className={`${appStyles.tabsContent} ${appStyles.tabsContainer}`}>
                        <div className={appStyles.tabsContent}>{tabActiveContent}</div>
                    </div>
                </div>
                <ToastContainerWrapper />
            </div>
        )
    }
    
}

export default App;
