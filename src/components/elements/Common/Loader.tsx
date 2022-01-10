import { Spinner } from "react-bootstrap";

const Loader = () => {
  return (
    <div className="d-flex justify-content-center align-items-center"><Spinner animation="border" variant="danger" style={{ height: '5rem', width: '5rem'}} size="lg"/></div>
  )
}

export default Loader;