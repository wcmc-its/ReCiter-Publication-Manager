import { Dialog, Button } from "../../ui";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  error?: boolean,
}

const NoAccessModal = ({ show, handleClose }: ExportModalProps) => {
  return (
    <Dialog
      open={show}
      onClose={handleClose}
      title="No access"
      footer={<Button variant="primary" onClick={() => handleClose()}>OK, continue</Button>}
    >
      You do not have sufficient privileges to visit other profiles. Please contact your administrator if you need access.
    </Dialog>
  )
}

export default NoAccessModal;
