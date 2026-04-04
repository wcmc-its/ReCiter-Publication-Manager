import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import UsersTable from "./UsersTable";
import { useRouter } from 'next/router'
import { adminUsersListAction, createORupdateUserIDAction, getAdminDepartments, getAdminRoles, sendNotification } from "../../../redux/actions/actions";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { toast } from "react-toastify"
import { reportError } from "../../../utils/reportError";
import { useSession } from 'next-auth/react';



const ManageUsers = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)

  const { data: session, status } = useSession(); const loading = status === "loading";

  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchText, setSearchText] = useState("")
  const [filterText, setFilterText] = useState("")
  const [pageLoading, setpageLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [nameOrcwidLabel, setNameOrcwidLabel] = useState()
  const [isVisibleNotification, setVisibleNotification] = useState(true)

  const router = useRouter()
  const dispatch = useDispatch();

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(100)


  useEffect(() => {
        dispatch(getAdminDepartments());
        dispatch(getAdminRoles());
        fetchAllAdminUsers(page, count)
        adminConfigurations();
  }, [])

  const adminConfigurations = () => {
    var viewAttributes = [];
    var emailNotifications = [];

    if (updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      let notificationsData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      viewAttributes = updatedData.viewAttributes;
      emailNotifications = notificationsData.viewAttributes;
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel.labelUserView)
    } else if (session?.adminSettings) {
      let adminSettings = JSON.parse(session.adminSettings);
      let data = adminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = JSON.parse(data.viewAttributes)
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      let notificationsData = adminSettings.find(obj => obj.viewName === "EmailNotifications")
      emailNotifications = JSON.parse(notificationsData.viewAttributes);
      cwidLabel && setNameOrcwidLabel(cwidLabel.labelUserView)
    }
    let settingsObj = emailNotifications && emailNotifications.find(data => data.isVisible)
    setVisibleNotification(settingsObj && settingsObj.isVisible || false)
  }

  // Re-derive findPeople and notification settings when admin settings arrive in Redux (async)
  useEffect(() => {
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      if (updatedData) {
        let viewAttributes = updatedData.viewAttributes;
        let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
        if (cwidLabel) setNameOrcwidLabel(cwidLabel.labelUserView)
      }
      let notificationsData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      if (notificationsData) {
        let emailNotifications = notificationsData.viewAttributes;
        let settingsObj = emailNotifications && emailNotifications.find(data => data.isVisible)
        setVisibleNotification(settingsObj && settingsObj.isVisible || false)
      }
    }
  }, [updatedAdminSettings])

  const fetchAllAdminUsers = (page?: number, limit?: number, searchTextInput?: string) => {
    setpageLoading(true);
    const offset = (page - 1) * limit;
    const request = { limit, offset, searchTextInput };
    fetch(`/api/db/admin/users`, {
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
        prepareTabelData(data.usersData)
        setTotalCount(data.totalUsersCount)
        dispatch(adminUsersListAction(data))
        setpageLoading(false);
        if (createORupdateUserID) toast.success(createORupdateUserID + " successfully", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
        dispatch(createORupdateUserIDAction(""))
      })
      .catch(error => {
        console.error("[ERR-5010]", error);
        reportError("ERR-5010", "Unable to load user list", error);
        setpageLoading(false);
        toast.error("Unable to load user list. Please try again. (ERR-5010)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      });
  }

  const prepareTabelData = (usersData) => {
    let tableData = [];
    usersData.map((data) => {
      const { nameFirst, nameLast, userID, personIdentifier, email, department, person, listRoles, scope_person_types, scope_org_units, proxy_person_ids } = data;
      if (data.AdminUserDept?.length > 0) {
        data.AdminUserDept && data.AdminUserDept.map((deptData => {
          let obj = {
            email: email,
            personIdentifier: personIdentifier,
            userID: userID,
            nameFirst: nameFirst,
            nameLast: nameLast,
            department: deptData.departmentLabel,
            primaryOrganizationalUnit: person && Object.keys(person).length > 0 && person.primaryOrganizationalUnit || "",
            listRoles: listRoles || [],
            scope_person_types: scope_person_types || null,
            scope_org_units: scope_org_units || null,
            proxy_person_ids: proxy_person_ids || null,
          }
          tableData.push(obj);
        }))
      } else {
        let obj = {
          email: email,
          personIdentifier: personIdentifier,
          userID: userID,
          nameFirst: nameFirst,
          nameLast: nameLast,
          department: "",
          primaryOrganizationalUnit: person && Object.keys(person).length > 0 && person.primaryOrganizationalUnit || "",
          listRoles: listRoles || [],
          scope_person_types: scope_person_types || null,
          scope_org_units: scope_org_units || null,
          proxy_person_ids: proxy_person_ids || null,
        }
        tableData.push(obj);
      }
    })
    setUsers(tableData);
    setAllUsers(tableData)
  }

  const onReset = () => {
    setPage(1);
    setCount(100);
    setSearchText("");
    setFilterText("");
    fetchAllAdminUsers(1, 100);
  }

  const handlePaginationUpdate = (newPage) => {
    setPage(newPage)
    fetchAllAdminUsers(newPage, count)
  }

  const handleCountUpdate = (newCount) => {
    if (newCount) {
      setPage(1);
      setCount(parseInt(newCount));
      fetchAllAdminUsers(1, parseInt(newCount))
    }
  }

  const handleSearchUpdate = (e) => {
    setSearchText(e.target.value);
  }

  const onSearch = () => {
    if (searchText.trim().length >= 3) {
      fetchAllAdminUsers(page, count, searchText)
    }
  }

  const handleFilterUpdate = (e) => {
    const text = e.target.value;
    setFilterText(text);
    if (!text) {
      setUsers(allUsers);
      return;
    }
    const term = text.toLowerCase();
    const filtered = allUsers.filter((user) => {
      return (
        (user.nameFirst && user.nameFirst.toLowerCase().includes(term)) ||
        (user.nameLast && user.nameLast.toLowerCase().includes(term)) ||
        (user.personIdentifier && user.personIdentifier.toLowerCase().includes(term)) ||
        (user.department && user.department.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.primaryOrganizationalUnit && user.primaryOrganizationalUnit.toLowerCase().includes(term))
      );
    });
    setUsers(filtered);
  }

  const onSendNotifications = () => {
    sendNotification()
  }

  const totalPages = Math.ceil(totalCount / count);

  return (
    <div className={appStyles.mainContainer}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manage Users</h1>
          <p className={styles.pageSubtitle}>Administer user access and notification settings</p>
        </div>
        <button className={styles.btnAdd} onClick={() => router.push("/manageusers/add")}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v10M3 8h10"/></svg>
          Add User
        </button>
      </div>

      {/* Search row */}
      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/></svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by name, CWID, or email..."
            value={searchText}
            onChange={handleSearchUpdate}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
        <button className={styles.btnSearch} onClick={onSearch}>Search</button>
        <button className={styles.btnReset} onClick={onReset}>Reset</button>
      </div>

      {pageLoading ? (
        <div className="d-flex justify-content-center align-items"><Loader /></div>
      ) : (
        <div className={styles.tableCard}>
          {/* Controls bar */}
          <div className={styles.tableControls}>
            <div className={styles.controlsLeft}>
              <span className={styles.ctrlLabel}>Show</span>
              <select className={styles.ctrlSelect} value={count} onChange={(e) => handleCountUpdate(e.target.value)}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span className={styles.ctrlLabel}>per page</span>
            </div>

            <div className={styles.filterWrap}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/></svg>
              <input
                className={styles.filterInput}
                type="text"
                placeholder="Filter this page..."
                value={filterText}
                onChange={handleFilterUpdate}
              />
            </div>

            {totalCount > 0 && (
              <div className={styles.pageNav}>
                <button className={styles.pageBtn} onClick={() => handlePaginationUpdate(page - 1)} disabled={page === 1}>&#8249;</button>
                <span className={styles.pageInfo}>
                  Page <strong>{page.toLocaleString()}</strong> of {totalPages.toLocaleString()}
                </span>
                <button className={styles.pageBtn} onClick={() => handlePaginationUpdate(page + 1)} disabled={page >= totalPages}>&#8250;</button>
              </div>
            )}
          </div>

          {/* Table */}
          <UsersTable
            isVisibleNotification={isVisibleNotification}
            data={users}
            onSendNotifications={onSendNotifications}
            nameOrcwidLabel={nameOrcwidLabel}
          />
        </div>
      )}
      <ToastContainerWrapper />
    </div>
  )
}

export default ManageUsers;
