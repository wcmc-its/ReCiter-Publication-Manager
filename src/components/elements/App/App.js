import React, { useState, useEffect, useRef } from "react";
import { useHistory } from 'react-router-dom';
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
import {getSession } from "next-auth/client"

const App = (props) => {

    const dispatch = useDispatch()
    const history = useHistory()

    const reciterFetching = useSelector((state) => state.reciterFetching)
    const reciterData = useSelector((state) => state.reciterData)
    const identityStateData = useSelector((state) => state.identityData)
    const identityFetching = useSelector((state) => state.identityFetching)
    const errors = useSelector((state) => state.errors)
    const auth = useSelector((state) => state.auth)

    const [tabActive, setTabActive] = useState("Suggested")
    const [identityData, setIdentityData] = useState({})
    const session = getSession();

    useEffect(() => {
        // Call only if user has curator_self role. otherwise, we should not call these APIs.
        if(session && session.data && session.data.userRoles && session.data.userRoles.length > 0 
            && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) 
         {   
            dispatch(reciterFetchData(props.uid, false))
            dispatch(identityFetchData(props.uid))
         }
    },[])

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
                    {reciterData.reciterPending.length > 0 ? (
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
