import React, { useState, FunctionComponent } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { PageHeader } from "../Common/PageHeader";
import ManageUsers from "./ManageUsers";
import RolesTab from "./RolesTab";
import PermissionsTab from "./PermissionsTab";
import styles from "./ManageUsersTabs.module.css";

const ManageUsersTabs: FunctionComponent = () => {
  const [tabIndex, setTabIndex] = useState<number>(0);

  return (
    <div className={styles.tabContainer}>
      <PageHeader label="Manage Users" />
      <Tabs
        value={tabIndex}
        onChange={(e, newValue) => setTabIndex(newValue)}
        sx={{
          "& .MuiTab-root": {
            fontSize: "14px",
            fontWeight: 400,
            color: "#666363",
            textTransform: "none",
            fontFamily: '"Open Sans", sans-serif, Arial',
          },
          "& .Mui-selected": {
            color: "#0d6efd !important",
            fontWeight: 600,
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "#0d6efd",
            height: "2px",
          },
        }}
      >
        <Tab label="Users" id="tab-0" aria-controls="tabpanel-0" />
        <Tab label="Roles" id="tab-1" aria-controls="tabpanel-1" />
        <Tab label="Permissions" id="tab-2" aria-controls="tabpanel-2" />
      </Tabs>
      <div
        role="tabpanel"
        id="tabpanel-0"
        aria-labelledby="tab-0"
        className={styles.usersPanel}
        style={{ display: tabIndex === 0 ? "block" : "none" }}
      >
        <ManageUsers />
      </div>
      {tabIndex === 1 && (
        <div
          role="tabpanel"
          id="tabpanel-1"
          aria-labelledby="tab-1"
          className={styles.tabPanel}
        >
          <RolesTab />
        </div>
      )}
      {tabIndex === 2 && (
        <div
          role="tabpanel"
          id="tabpanel-2"
          aria-labelledby="tab-2"
          className={styles.tabPanel}
        >
          <PermissionsTab />
        </div>
      )}
    </div>
  );
};

export default ManageUsersTabs;
