import { Modal, Button, Alert } from "react-bootstrap";
import { ExportButton } from "./ExportButton";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  countInfo: string,
  exportArticle: () => void,
  exportArticleLoading?: boolean,
  exportAuthorship?: () => void,
  exportArticlePeople?: () => void, 
  exportArticlePeopleLoading?: boolean,
  error?: boolean
}

const ExportModal = ({ show, handleClose, title, countInfo, exportArticle, exportAuthorship, exportArticlePeople, error, exportArticleLoading, exportArticlePeopleLoading }: ExportModalProps) => {
  return (
    <div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export to {title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>According to the criteria you have set, there are {countInfo}</p>
        <ExportButton isDisplay={exportAuthorship != null} onClick={exportAuthorship} title="Export authorship report"/>
        <ExportButton isDisplay={true} onClick={exportArticle} title="Export Article Report" loading={exportArticleLoading} />
        <ExportButton isDisplay={exportArticlePeople != null} onClick={exportArticlePeople} title="Export articles as RTF" loading={exportArticlePeopleLoading} />
        {error && <Alert variant="danger">Error occured exporting, please try again later.</Alert>}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default ExportModal;