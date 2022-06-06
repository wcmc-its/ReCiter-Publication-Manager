import { Button, Spinner } from "react-bootstrap";

interface ExportButtonTypes {
  isDisplay: boolean, 
  onClick?: () => void, 
  loading?: boolean,
  title: string
}

export const ExportButton = ({ isDisplay, onClick, loading, title }: ExportButtonTypes) => {
  if (!isDisplay) {
    return null
  }

  if (loading) {
    return (
      <Button variant="warning" className="m-2" disabled>
        <Spinner
          as="span"
          animation="grow"
          size="sm"
          role="status"
          aria-hidden="true"
        />
        Loading...
      </Button>
    )
  }

  return (
    <Button variant="warning" className="m-2" onClick={onClick}>{title}</Button>
  )
}