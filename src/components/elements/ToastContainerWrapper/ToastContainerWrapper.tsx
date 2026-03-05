import React, { useState, useEffect, useRef } from "react";
import { ToastContainer } from 'react-toastify';
import { useSelector, useDispatch,RootStateOrAny } from "react-redux";
import { useSession } from 'next-auth/react';




const ToastContainerWrapper = () => {
  const { data: session, status } = useSession();

  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false)

  
  useEffect(() => {
    let displayToastMessages: any[] = [];
    if (updatedAdminSettings && updatedAdminSettings.length > 0) { 
      const displayMessages = updatedAdminSettings.find((obj:any) => obj.viewName === "displayMessages")
      displayToastMessages = displayMessages.viewAttributes ?? [];
    }else if(typeof updatedAdminSettings === 'string' && updatedAdminSettings.trim()){
        const parsedSettings = updatedAdminSettings && JSON.parse(updatedAdminSettings);
        let displayMessages = parsedSettings?.find((obj:any) => obj.viewName === "displayMessages")
        displayToastMessages = displayMessages? JSON.parse(displayMessages.viewAttributes):[];
    }
    let getVisibleKey =  displayToastMessages && Array.isArray(displayToastMessages) && displayToastMessages.find((obj:any) => obj.isVisible)
    setIsToastVisible(getVisibleKey && getVisibleKey.isVisible || false );
  },[updatedAdminSettings])
    
    return isToastVisible && <ToastContainer />
}

export default ToastContainerWrapper