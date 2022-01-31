import React, { useState } from "react";
import filterPublications from "../../../utils/filterPublications";
import { Tab, Tabs } from "react-bootstrap";
import ReciterTabContent from "./ReciterTabContent";
import styles from "./CurateIndividual.module.css";

const ReciterTabs = ({ reciterData, fullName, feedbacklog } : {reciterData: any, fullName: string, feedbacklog: any}) => {
  //default tab
  const [key, setKey] = useState('NULL');

  const tabsData = [
    { name: 'Suggested', value: 'NULL'},
    { name: 'Accepted', value: 'ACCEPTED'},
    { name: 'Rejected', value: 'REJECTED'},
  ]

  let filteredData = [];
  tabsData.forEach((tab) => {
    let filteredReciterData = filterPublications(reciterData, tab.value, "");
    filteredData.push({ value: tab.value, name: tab.name, data: filteredReciterData, count: filteredReciterData.length})
  })

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
                <div className={key === tabData.value ? `${styles.activeTab} ${styles.tabTitle}` : styles.tabTitle}>{tabData.name}<span className={key === tabData.value ? `${styles.activeCount} ${styles.count}` : styles.count}>{tabData.count}</span></div>
              }>
                <ReciterTabContent 
                  tabType={tabData.value}
                  publications={tabData.data}
                  index={index}
                  personIdentifier={reciterData.reciter.personIdentifier}
                  fullName={fullName}
                  feedbacklog={feedbacklog}
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