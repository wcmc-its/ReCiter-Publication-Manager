import { DropdownWrapper } from "../Common/DropdownWrapper";
import { Form } from "react-bootstrap";

export const CheckList = ({ title, options }) => {
  return (
    <DropdownWrapper title={title}>
      <div>
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