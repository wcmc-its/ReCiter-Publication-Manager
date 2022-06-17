import { useState, useEffect } from "react";

type UpdateModal = () => void

export const useModal = (): [boolean, string, (uid: string) => void, () => void, () => void] => {
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [uid, setUid] = useState<string>('');


  const handleClose = () => { 
    setOpenModal(false);
  }

  const handleShow: UpdateModal = () => {
    setOpenModal(true);
  }

  const updateUid = (newUid: string) => {
    setUid(newUid);
  }

  return [openModal, uid, updateUid, handleClose, handleShow];
}