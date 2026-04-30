import React, { useMemo } from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, RootStateOrAny } from "react-redux";
import { useSession } from 'next-auth/client';

const ToastContainerWrapper = () => {
  const [session] = useSession();
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings);

  const isToastVisible = useMemo(() => {
    let displayToastMessages: any[] = [];
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      const displayMessages = updatedAdminSettings.find((obj: any) => obj.viewName === "displayMessages");
      // viewAttributes may be a parsed array (post fetchAdminSettingsAction
      // normalization in actions.js) or still a JSON-encoded string. Handle
      // both so a Configuration save flips the wrapper without a reload.
      const raw = displayMessages?.viewAttributes;
      displayToastMessages = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
    } else if ((session as any)?.adminSettings) {
      try {
        const parsed = JSON.parse((session as any).adminSettings);
        const displayMessages = Array.isArray(parsed) && parsed.find((obj: any) => obj.viewName === "displayMessages");
        const raw = displayMessages?.viewAttributes;
        displayToastMessages = typeof raw === "string" ? JSON.parse(raw) : (raw || []);
      } catch {
        displayToastMessages = [];
      }
    }
    const visibleEntry = displayToastMessages.find((obj: any) => obj?.isVisible);
    return !!visibleEntry?.isVisible;
  }, [updatedAdminSettings, session]);

  return isToastVisible ? <ToastContainer /> : null;
};

export default ToastContainerWrapper;
