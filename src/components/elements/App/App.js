import React, { useState, useEffect, useRef } from "react";
import appStyles from './App.module.css';
import { useSelector, useDispatch } from "react-redux";
import { identityFetchData, reciterFetchData, otherPublicationsFetchData } from '../../../redux/actions/actions'
import Tabs from '../Tabs/Tabs'
import TabAccepted from '../TabAccepted/TabAccepted';
import TabSuggested from '../TabSuggested/TabSuggested';
import TabRejected from '../TabRejected/TabRejected';
import TabAddPublication from '../TabAddPublication/TabAddPublication';
import TabExternalSource from '../TabExternalSource/TabExternalSource';
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
    // ReCiter-Publication-Manager#873: this was `getSession()` (unawaited Promise,
    // .data always undefined) with a dead `userPermissions`/`allowedPermissions`
    // reference below it -- the fetch never fired for anyone. useSession() is the
    // hook every other component in this codebase already uses for client-side
    // session data (see Header.tsx, CurateIndividual.tsx).
    const { data: session } = useSession()

    useEffect(() => {
        // Self-service faculty view (Curator_Self) or an admin previewing/testing
        // a record (Curator_All / Superuser) -- not curator-scoped, which is a
        // proxy-for-specific-people grant this page doesn't check against props.uid.
        // session.data.userRoles is a JSON string, not an array (matches the
        // JSON.parse(session.data.userRoles) pattern already used in Search.js /
        // middleware.ts) -- getCapabilities() silently no-ops on a raw string.
        const rawUserRoles = session && session.data && session.data.userRoles
        const userRoles = rawUserRoles ? JSON.parse(rawUserRoles) : []
        const caps = getCapabilities(userRoles)
        if (userRoles.length > 0 && (caps.canCurate.self || caps.canCurate.all))
         {
            dispatch(reciterFetchData(props.uid, false))
            dispatch(identityFetchData(props.uid))
            dispatch(otherPublicationsFetchData(props.uid))
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
            case "Scopus":
                tabActiveContent = <TabExternalSource uid={props.uid} source="SCOPUS" />;
                break;
            case "OpenAlex":
                tabActiveContent = <TabExternalSource uid={props.uid} source="OPENALEX" />;
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
