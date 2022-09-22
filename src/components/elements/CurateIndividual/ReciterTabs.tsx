import React, { useEffect, useState } from "react";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs, Badge } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";
import { RootStateOrAny, useDispatch, useSelector } from "react-redux";
import TabAddPublication from "../TabAddPublication/TabAddPublication";
import { allowedPermissions } from "../../../utils/constants";
import { useSession } from "next-auth/client";
import { showEvidenceByDefault } from "../../../redux/actions/actions";


const ReciterTabs = ({ reciterData, fullName, fetchOriginalData }: { reciterData: any, fullName: string, fetchOriginalData: any }) => {
  //default tab
  const [key, setKey] = useState('NULL');
  const dispatch = useDispatch();
  const [filteredData, setFilteredData] = useState([])
  const [pubKey, setPubKey] = useState(false);
  const [session, loading] = useSession();
  const isSearchText = useSelector((state: RootStateOrAny) => state.curateSearchtext)
  const showEvidenceDefault = useSelector((state: RootStateOrAny) => state.showEvidenceDefault)


  const addnewtabName = <p id="addnewtabName" className="noSpace" >Add New record:</p>
  const pubMedTabName = <p id="pubMedTabName" className="text-primary noSpace" ><span >PubMed</span></p>

  const tabsData = [
    { name: 'Suggested', value: 'NULL',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: 'Accepted', value: 'ACCEPTED',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: 'Rejected', value: 'REJECTED',allowedRoleNames: ["Superuser", "Curator_All","Curator_Self"] },
    { name: addnewtabName, value: 'addNewRecord',allowedRoleNames: ["Superuser","Curator_Self","Curator_All"] },
    { name: pubMedTabName, value: 'AddPub', allowedRoleNames: ["Superuser","Curator_Self","Curator_All"] },
  ]

  useEffect(() => {
    let publicationsPerTabs = [];
    tabsData.forEach((tab) => {
      let filteredReciterData = filterPublications(reciterData, tab.value, "");
      publicationsPerTabs.push({ value: tab.value, name: tab.name, data: filteredReciterData, count: filteredReciterData.length, allowedRoleNames: tab.allowedRoleNames})
    })
    setFilteredData(publicationsPerTabs);
  }, [])

  const updatePublicationAssertion = (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => {
    let updatedFilteredData = [...filteredData];

    updatedFilteredData.forEach((tabData) => {
      // If Tab matches the updated user assertion, add the article in the tab
      if (tabData.value == userAssertion) {
        tabData.data.push(reciterArticle);
        tabData.count = tabData.count + 1;
      } else if (tabData.value == prevUserAssertion) {
        // If Tab matches the previous user assertion, remove from that tab
        let index = tabData.data.findIndex(i => i.pmid === reciterArticle.pmid);
        if (index > -1) { tabData.data.splice(index, 1) }
        if (tabData.count > 0) { tabData.count = tabData.count - 1; }
      }
    })

    setFilteredData(updatedFilteredData);
    // setKey(prevUserAssertion)
  }

  const updatePublicationAssertionBulk = (reciterArticles: any, userAssertion: string, prevUserAssertion: string) => {
    let updatedFilteredData = [...filteredData];
    updatedFilteredData.forEach((tabData) => {
      // If Tab matches the updated user assertion, add the article in the tab
      if (tabData.value == userAssertion) {
        tabData.data.push(...reciterArticles);
        tabData.count = tabData.count + reciterArticles.length;
      } else if (tabData.value == prevUserAssertion) {
        // If Tab matches the previous user assertion, remove from that tab
        let count = tabData.count;
        reciterArticles.forEach((reciterArticle) => {
          let index = tabData.data.findIndex(i => i.pmid === reciterArticle.pmid);
          if (index > -1) { tabData.data.splice(index, 1) }
          if (count > 0) { count--; }
        })
        tabData.count = count;
      }
    })
    setFilteredData(updatedFilteredData);
    // setKey(userAssertion)
  }

  const onTabChange = (k)=>{
    setKey(k)
    if(k === "AddPub"){
      document.getElementById('addnewtabName').innerHTML = "<i>Adding New record from</i>";
      document.getElementById('pubMedTabName').innerHTML = '<span style="color:black ; font-style:italic; font-weight: normal">PubMed...</span>';
    }else{
      document.getElementById('addnewtabName').innerHTML = "Add New record:";
      document.getElementById('pubMedTabName').innerHTML = 'PubMed'
    }
    dispatch(showEvidenceByDefault(false));
  }

  return (
    <>
      <Tabs
        id="controlled-tab-example"
        activeKey={key}
        onSelect={(k) => onTabChange (k)}
        className={`${styles.tabsContainer}`}
      > {
          filteredData.map((tabData: any, index: number) => {
            let userPermissions = JSON.parse(session.data.userRoles);
            const matchedRoles = userPermissions.filter(role => tabData.allowedRoleNames.includes(role.roleLabel));
            if(matchedRoles.length >= 1){
            return (
              <Tab
                eventKey={tabData.value}
                key={tabData.value}
                className={tabData.value === "AddPub" ? `${styles.curateTabsMainPub}` : `${styles.curateTabsMain}`}
                disabled={tabData.value === "addNewRecord" ? true : false}
                tabClassName={tabData.value === "addNewRecord" ? `${styles.tabDisplayNone}` : tabData.value === "AddPub" ? `${styles.pubMadeTab}` : `${styles.tabsMain}`}
                title={
                  <div className={key === tabData.value ? `${styles.activeTab} ${styles.tabTitle}` : styles.tabTitle}>{tabData.name} {tabData.value === "addNewRecord" || tabData.value === "AddPub" ? "" : <div className={key === tabData.value ? `${styles.active} ${styles.circle}` : styles.circle}><span className={key === tabData.value ? `${styles.activeCount} ${styles.count}` : styles.count}>{tabData.count}</span></div>}</div>
                }>
                {
                  key === "AddPub" ?
                    <TabAddPublication 
                    updatePublicationAssertion={updatePublicationAssertion}
                    tabType={tabData.value}
                    personIdentifier={reciterData.reciter?.personIdentifier}
                     />
                    :
                    <ReciterTabContent
                      tabType={tabData.value}
                      publications={tabData.data}
                      index={index}
                      personIdentifier={reciterData.reciter?.personIdentifier}
                      fullName={fullName}
                      updatePublicationAssertion={updatePublicationAssertion}
                      updatePublicationAssertionBulk={updatePublicationAssertionBulk}
                      isSearchText={isSearchText}
                      isShowEvidenceByDefault = {showEvidenceDefault}
                      activeKey = {key}
                      totalCount={tabData.value === "NULL" ? tabData.count : tabData.value === "ACCEPTED" ? tabData.count : tabData.value ==="REJECTED" ?  tabData.count : ""}
                    />
                }
              </Tab>
            )
              }
          })
        }
      </Tabs>
    </>
  )
}

export default ReciterTabs;