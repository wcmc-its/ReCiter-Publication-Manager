import React, { useEffect, useState } from "react";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";

const ReciterTabs = ({ reciterData, fullName,fetchOriginalData } : {reciterData: any, fullName: string,fetchOriginalData: any }) => {
  //default tab
  const [key, setKey] = useState('NULL');
  const [filteredData, setFilteredData] = useState([])

  const tabsData = [
    { name: 'Suggested', value: 'NULL'},
    { name: 'Accepted', value: 'ACCEPTED'},
    { name: 'Rejected', value: 'REJECTED'},
  ]

  useEffect(() => {
    let publicationsPerTabs = [];
    tabsData.forEach((tab) => {
      let filteredReciterData = filterPublications(reciterData, tab.value, "");
      publicationsPerTabs.push({ value: tab.value, name: tab.name, data: filteredReciterData, count: filteredReciterData.length})
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
        if (index > -1) { tabData.data.splice(index, 1)}
        if (tabData.count > 0) { tabData.count = tabData.count - 1; }
      }
    })

    setFilteredData(updatedFilteredData);
    // fetchOriginalData();

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
          if (index > -1) { tabData.data.splice(index, 1)}
          if (count > 0) { count--; }
        })
        tabData.count = count;
      }
    })
    setFilteredData(updatedFilteredData);

    // fetchOriginalData();
  }

  return (
    <>
      <Tabs
        id="controlled-tab-example"
        activeKey={key}
        onSelect={(k) => setKey(k)}
        className={`my-3 ${styles.tabsContainer}`}
      > {
          filteredData.map((tabData: any, index: number) => {
            return (
              <Tab
              eventKey={tabData.value}
              key={tabData.value}
              title={
                <div className={key === tabData.value ? `${styles.activeTab} ${styles.tabTitle}` : styles.tabTitle}>{tabData.name}<div className={key === tabData.value ? `${styles.active} ${styles.circle}` : styles.circle}><span className={key === tabData.value ? `${styles.activeCount} ${styles.count}` : styles.count}>{tabData.count}</span></div></div>
              }>
                <ReciterTabContent 
                  tabType={tabData.value}
                  publications={tabData.data}
                  index={index}
                  personIdentifier={reciterData.reciter.personIdentifier}
                  fullName={fullName}
                  updatePublicationAssertion={updatePublicationAssertion}
                  updatePublicationAssertionBulk={updatePublicationAssertionBulk}
                />
              </Tab>
            )
          })
        }
      </Tabs>
    </>
  )
}

export default ReciterTabs;