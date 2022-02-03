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

  const getAction = (feedback) => {
    switch (feedback) {
      case 'ACCEPTED':
        return 'Accepted';
        break;
      case 'REJECTED':
        return 'Rejected';
        break;
      case 'NULL':
        return 'Suggested';
        break;
      default:
        return 'Suggested';
        break;
    }
  }

  const Feedbacklog = ({ userId, timestamp, feedback}) => {
    let date = new Date(timestamp);
    let action = getAction(feedback);
    return (
      <p>{`${action} by ${userId} at ${date}`}</p>
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
                userId={feedback.AdminUser?.personIdentifier}
                timestamp={feedback.modifyTimestamp}
                feedback={feedback.feedback}
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
    <Modal show={props.showModal} onHide={props.onClose} size="lg">
      <Modal.Header closeButton>Feedback History</Modal.Header>
      <Modal.Body>
        <ModalContent />
      </Modal.Body>
    </Modal>
  )
}

export default HistoryModal;