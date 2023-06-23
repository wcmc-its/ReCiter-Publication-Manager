import { Spinner } from "react-bootstrap";

const Loader = () => {
  return (
    <div className="d-flex h-100 justify-content-center align-items-center"><Spinner animation="border" variant="danger" style={{ height: '5rem', width: '5rem'}}/></div>
  )
}

export default Loader;