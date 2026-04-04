import React, { useState, useEffect, useRef } from "react";
import { ToastContainer } from 'react-toastify';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { useSession } from 'next-auth/react';



const ToastContainerWrapper = () => {
  const { data: session, status } = useSession(); const loading = status === "loading";

  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false)

  useEffect(() => {
    var displayToastMessages = [];
    if (updatedAdminSettings.length > 0) {
      let displayMessages = updatedAdminSettings.find(obj => obj.viewName === "displayMessages")
      displayToastMessages = displayMessages?.viewAttributes || [];
    } else if (session?.adminSettings) {
        let adminSettings = JSON.parse(JSON.stringify(session.adminSettings));
        let displayMessages = JSON.parse(adminSettings).find(obj => obj.viewName === "displayMessages")
        displayToastMessages = displayMessages ? JSON.parse(displayMessages.viewAttributes) : [];
    }
    let getVisibleKey =  displayToastMessages && displayToastMessages.find(obj => obj.isVisible)
    setIsToastVisible(getVisibleKey && getVisibleKey.isVisible || false );
  },[])

  // Re-derive toast visibility when admin settings arrive in Redux (async)
  useEffect(() => {
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      let displayMessages = updatedAdminSettings.find(obj => obj.viewName === "displayMessages")
      let displayToastMessages = displayMessages?.viewAttributes || [];
      let getVisibleKey = displayToastMessages.find(obj => obj.isVisible)
      setIsToastVisible(getVisibleKey && getVisibleKey.isVisible || false)
    }
  }, [updatedAdminSettings])

    return isToastVisible && <ToastContainer />
}

export default ToastContainerWrapper