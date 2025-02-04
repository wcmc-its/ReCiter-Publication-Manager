import React, { useState, useEffect, useRef } from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, useDispatch,RootStateOrAny } from "react-redux";
import { useSession } from 'next-auth/react';



const ToastContainerWrapper = () => {
  const { data: session, status } = useSession();

  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false)

  useEffect(() => {
    //  
   let adminSettings = session && JSON.parse(JSON.stringify((session as any)?.adminSettings));
   // let adminSettings = session?.data.adminSettings;
   //let adminSettings = JSON.stringify((session as any)?.adminSettings) && JSON.parse(JSON.stringify((session as any)?.adminSettings) );
    var displayToastMessages = [];
    if (updatedAdminSettings.length > 0) { 
      let displayMessages = updatedAdminSettings.find(obj => obj.viewName === "displayMessages")
      displayToastMessages = displayMessages.viewAttributes;
    }else{
        let displayMessages = adminSettings && JSON.parse(adminSettings).find(obj => obj.viewName === "displayMessages")
        displayToastMessages = displayMessages && JSON.parse(displayMessages.viewAttributes);
    }
    let getVisibleKey =  displayToastMessages && displayToastMessages.find(obj => obj.isVisible)
    setIsToastVisible(getVisibleKey && getVisibleKey.isVisible || false );
  },[])
    
    return isToastVisible && <ToastContainer />
}

export default ToastContainerWrapper