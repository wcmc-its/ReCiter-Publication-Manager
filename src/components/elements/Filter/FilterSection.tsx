import React from "react";
import styles from './Filter.module.css';
import appStyles from '../App/App.module.css';
import { Button, Container, Row, DropdownButton, Col, Dropdown } from 'react-bootstrap';
import Link from 'next/link'

interface DropdownProps {
  title: string,
  children?: Array<string>,
}

interface SectionProps {
  list: Array<DropdownProps>
  buttonTitle?: string,
  buttonUrl: string,
}

const FilteSection: React.FC<SectionProps> = (props) => {
  return (
    <div className={styles.filterSection}>
      <Container>
        <Row>
          {
            props.list && props.list.map((item: DropdownProps) => {
              return (
                <Col lg={2} md={4} sm={6}>
                  <Dropdown>
                    <Dropdown.Toggle className={item.children ? `${styles.filterDropdown} ${styles.filled}` : styles.filterDropdown } key={item.title} id={item.title}>
                    {item.title}
                    </Dropdown.Toggle>
                      {
                        item.children && 
                          <Dropdown.Menu>
                          {item.children.map((dropdownItem: string) => {
                          return (
                            <Dropdown.Item key={dropdownItem}>{dropdownItem}</Dropdown.Item>
                          )
                          })}
                        </Dropdown.Menu>
                      }
                  </Dropdown>
                </Col>
              )
            })
          }
          <Col lg={4} md={4} sm={12}>
            <Link href={props.buttonUrl} passHref>
              <Button variant="warning">{props.buttonTitle}</Button>
            </Link>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default FilteSection;
