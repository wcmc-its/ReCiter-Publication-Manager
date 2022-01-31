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
      let feedbacksToDisplay = showAll ? props.feedbacklog[props.id] : props.feedbacklog[props.id].slice(0, defaultLogsSize);
      return (
        <>
        {
          feedbacksToDisplay.map((feedback, i) => {
            return (
              <Feedbacklog 
                key={i}
                userId={feedback.userID}
                timestamp={feedback.modifyTimestamp}
                />
            )
          })
        }
        {props.feedbacklog[props.id].length > defaultLogsSize && !showAll && <div className="text-btn text-center" onClick={() => setShowAll(true)}>Show More</div>}
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