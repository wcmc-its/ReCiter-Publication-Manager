import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { fetchFeedbacklog } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
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
  const [feedbacklog, setFeedbacklog] = useState({});
  const [feedbacklogFetching, setFeedbacklogFetching] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (props.showModal) {
      setFeedbacklogFetching(true);
      fetch(`/api/db/admin/feedbacklog/${props.userId}`, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
        }
      }).then(response => {
        if (response.status === 200) {
          return response.json()
        } else {
          throw {
            type: response.type,
            title: response.statusText,
            status: response.status,
            detail: "Error occurred with api " + response.url + ". Please, try again later "
          }
        }
      }).then(data => {
        let articleIds = data.map((feedback) => { return feedback.articleIdentifier })
        articleIds = articleIds.filter((feedback, i) => { return articleIds.indexOf(feedback) === i });
        let feedbacklogData = {};
        articleIds.forEach((articleId) => {
          let articleFeedbacks = data.filter((feedbackLog) => { if (feedbackLog.articleIdentifier === articleId) return feedbackLog });
          feedbacklogData[articleId] = articleFeedbacks;
        })
        setFeedbacklog(feedbacklogData);
        setFeedbacklogFetching(false);
      }).catch(error => {
        console.log(error);
        setFeedbacklogFetching(false);
        setIsError(true);
      })
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
       {feedbacklogFetching ? <Loader/> : isError? <p>Something went wrong. Please try again later.</p> : <ModalContent />}
      </Modal.Body>
    </Modal>
  )
}

export default HistoryModal;