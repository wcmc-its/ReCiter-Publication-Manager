import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { fetchFeedbacklog } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import Loader from "../Common/Loader";
import moment from 'moment-timezone';

interface HistoryModalProps {
  showModal: boolean
  onOpen: () => void
  onClose: () => void
  id: string
  userId: string
}

const HistoryModal: React.FC<HistoryModalProps> = (props) => {
  const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)

  const [showAll, setShowAll] = useState<boolean>(false);
  const defaultLogsSize: number = 20;
  const dispatch = useDispatch();
  const [feedbacklogFetching, setFeedbacklogFetching] = useState(false);
  const [isError, setIsError] = useState(false);


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

  const Feedbacklog = ({ userId, timestamp, feedback, userDetails}) => {
    let date = new Date(timestamp).toUTCString();
    date = moment().tz("America/New_York").format("YYYY-MM-DD HH:mm:ss z")
    let action = getAction(feedback);
    let userFullName = userDetails.nameFirst + " "+ userDetails.nameLast;
    return (
      <p>{`Marked as ${action.toLowerCase()} by ${userFullName} (${userId}) at ${date}`}</p>
    )
  };
  
  const ModalContent = () => {
    if (!feedbacklog[props.id]) {
      return (
        <p>No history found</p>
      )
    } else {
      let feedbacksToDisplay = showAll ? feedbacklog[props.id] : feedbacklog[props.id].slice(0, defaultLogsSize);
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
                userDetails={feedback.AdminUser}
                />
            )
          })
        }
        {feedbacklog[props.id].length > defaultLogsSize && !showAll && <div className="text-btn text-center" onClick={() => setShowAll(true)}>Show More</div>}
        </>
      )
    }
  }

  return (
    <Modal show={props.showModal} onHide={props.onClose} size="lg">
      <Modal.Header closeButton>Feedback History</Modal.Header>
      <Modal.Body>
       {feedbacklogFetching ? <Loader/> : isError? <p>Something went wrong. Please try again later.</p> : <ModalContent />}
      </Modal.Body>
    </Modal>
  )
}

export default HistoryModal;