import React, { useState } from "react";
import { Modal } from "react-bootstrap";

interface HistoryModalProps {
  showModal: boolean
  onOpen: () => void
  onClose: () => void
  id: string
  feedbacklog: any
}

const HistoryModal: React.FC<HistoryModalProps> = (props) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const defaultLogsSize: number = 20;

  const Feedbacklog = ({ userId, timestamp}) => {
    let date = new Date(timestamp);
    return (
      <p>{`Modified by ${userId} at ${date}`}</p>
    )
  };
  
  const ModalContent = () => {
    if (!props.feedbacklog[props.id]) {
      return (
        <p>No history found</p>
      )
    } else {
      return (
        <>
        {
          props.feedbacklog[props.id].map((feedback) => {
            return (
              <Feedbacklog 
                userId={feedback.userID}
                timestamp={feedback.modifyTimestamp}
                />
            )
          })
        }
        </>
      )
    }
  }

  return (
    <Modal show={props.showModal} onHide={props.onClose}>
      <ModalContent />
    </Modal>
  )
}

export default HistoryModal;