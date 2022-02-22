import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { fetchFeedbacklog } from "../../../redux/actions/actions";
import Loader from "../Common/Loader";


interface HistoryModalProps {
  showModal: boolean
  onOpen: () => void
  onClose: () => void
  id: string
  userId: string
}

const HistoryModal: React.FC<HistoryModalProps> = (props) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const defaultLogsSize: number = 20;
  const dispatch = useDispatch();
  const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)
  const feedbacklogFetching = useSelector((state: RootStateOrAny) => state.feedbacklogFetching)

  useEffect(() => {
    if (props.showModal) {
      dispatch(fetchFeedbacklog(props.userId));
    }
  }, [props.showModal])

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
       {feedbacklogFetching ? <Loader/> : <ModalContent />}
      </Modal.Body>
    </Modal>
  )
}

export default HistoryModal;