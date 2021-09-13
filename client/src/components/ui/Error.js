import React from "react";
import { Toast, Row, Col, Button } from "react-bootstrap";

export const Error = ({ errors }) => {
  const [show, setShow] = React.useState(false);

  return (
    <Row>
      <Col xs={6}>
        <Toast onClose={() => setShow(false)} show={show} delay={3000} autohide>
          <Toast.Header>
            <img
              src="holder.js/20x20?text=%20"
              className="rounded me-2"
              alt=""
            />
            <strong className="me-auto">Bootstrap</strong>
            <small>11 mins ago</small>
          </Toast.Header>
          <Toast.Body>Woohoo, you're reading this text in a Toast!</Toast.Body>
        </Toast>
      </Col>
      <Col xs={6}>
        <Button style={{float: 'right'}} onClick={() => setShow(true)}>Error with the application - {errors.length > 0 && (<div>{errors[0].detail + " - status code - " + errors[0].status}</div>)}</Button>
      </Col>
    </Row>
  );
};
