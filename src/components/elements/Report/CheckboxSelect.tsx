import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form, InputGroup, FormControl, Button } from "react-bootstrap";
import { AiOutlineSearch } from "react-icons/ai";

export const CheckboxSelect = ({ title, options}) => {
  return (
    <DropdownWrapper title={title}>
      <div>
      <InputGroup className="mb-3">         
       <FormControl
            className="border-right-0 border-top-right-radius-0 border-bottom-right-radius-0"
            placeholder="Search"
            aria-label={title}
            aria-describedby={title}
          />
            <div className="d-flex border-grey p-1 rounded-right align-items-center">
              <AiOutlineSearch style={{ marginTop: "-2px" }} />
            </div>
       </InputGroup>
        {
          options.map((option) => {
            return (
              <Form.Check
                type="checkbox"
                id={option.key}
                label={option.label}
                />
            )
          })
        }
      </div>
    </DropdownWrapper>
  )
}
