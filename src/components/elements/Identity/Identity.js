import React from "react";
import { Button } from "react-bootstrap";
import Router from "next/router"
import styles from "./Identity.module.css";
import appStyles from '../App/App.module.css';

const Identity = (props) => {

    const manageProfile = event => {
        event.preventDefault()
        if(props.buttonName === 'Manage Profile') {
            Router.push(`${window.location.origin}/manage/` + props.uid);
        }
        if(props.buttonName === 'Review Suggestions'){
            Router.push(`${window.location.origin}/app/` + props.uid);
        }
    }

    if (props.identityFetching || props.identityData.length <= 0) {
        return (
                <div className={appStyles.appLoader}> </div>
        );
    } else {
        const identityData = props.identityData
        let imageUrl = ''
        if(identityData.identityImageEndpoint !== undefined) {
            if(identityData.identityImageEndpoint.length > 0) 
                imageUrl = identityData.identityImageEndpoint
            else
                imageUrl = '../../../../public/images/profile-pic.jpg'
        }
        const image = (
            <img src={`${imageUrl}`} width="144" className={styles.imgProps}/>
        );
        const userData = {
            primaryName: identityData.primaryName.firstName + ((identityData.primaryName.middleName !== undefined)? ' ' + identityData.primaryName.middleName + ' ':' ') + identityData.primaryName.lastName,
            title: identityData.title
        };

        return (
            <div className={styles.userContainer}>
                <div className={styles.userImg}>{image}</div>
                <div className={styles.userName}>
                    <h1 className={styles.h1Props}>{userData.primaryName}</h1>
                </div>
                <div className={styles.userTitle}>
                    <h3 className={styles.h3Props}>{userData.title}</h3>
                </div>
                <div className={styles.btnContainer}>
                    <Button className={styles.manageBtn} variant="outline-dark" onClick={manageProfile}>
                        {props.buttonName}
                    </Button>
                </div>
            </div>
        );
    }
    
}

export default Identity