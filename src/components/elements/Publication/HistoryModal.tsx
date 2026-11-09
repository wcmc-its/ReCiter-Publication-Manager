import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { Sheet, Button } from "../../ui";
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
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

  // Accepted green, rejected red, anything else (suggested / reset) muted.
  const dotColor = (feedback) =>
    feedback === 'ACCEPTED' ? 'var(--pm-green)' : feedback === 'REJECTED' ? 'var(--pm-red)' : 'var(--pm-muted-foreground)';

  const Feedbacklog = ({ userId, timestamp, feedback, userDetails}) => {
    let date = new Date(timestamp).toUTCString();
    date = moment(date).tz("America/New_York").format("YYYY-MM-DD HH:mm:ss z")
    let action = getAction(feedback);
    let userFullName = userDetails.nameFirst + " "+ userDetails.nameLast;
    return (
      <Box component="li" sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1.25, borderBottom: '1px solid var(--pm-border)' }}>
        <Box component="span" aria-hidden sx={{ mt: '7px', width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor(feedback), flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box component="span" sx={{ fontSize: 13.5 }}>
            <strong style={{ fontWeight: 600 }}>{action}</strong> by {userFullName} ({userId})
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'var(--pm-muted-foreground)' }}>{date}</Box>
        </Box>
      </Box>
    )
  };

  const ModalContent = () => {
    if (!feedbacklog[props.id]) {
      return (
        <Box sx={{ py: 3, textAlign: 'center', fontSize: 13, color: 'var(--pm-muted-foreground)' }}>No history found</Box>
      )
    } else {
      let feedbacksToDisplay = showAll ? feedbacklog[props.id] : feedbacklog[props.id].slice(0, defaultLogsSize);
      return (
        <>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
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
        </Box>
        {feedbacklog[props.id].length > defaultLogsSize && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} sx={{ mt: 1, color: 'var(--pm-slate)' }}>Show more</Button>
        )}
        </>
      )
    }
  }

  return (
    <Sheet open={props.showModal} onClose={props.onClose} title="Feedback history" description={`PMID ${props.id}`}>
      {feedbacklogFetching ? <Loader/> : isError? <p>Unable to load feedback history. Please try again.</p> : <ModalContent />}
    </Sheet>
  )
}

export default HistoryModal;