import React, { useState, useEffect, useRef } from "react";
import { Button, Form, Row, Col, Container , Dropdown, InputGroup } from "react-bootstrap";
import { orgUnitsFetchAllData, institutionsFetchAllData } from '../../../redux/actions/actions';
import { useSelector, useDispatch } from "react-redux";
import styles from './Search.module.css'
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';

const SearchBar = (props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [orgUnitQuery, setOrgUnitQuery] = useState('');
  const [insitutionQuery, setInstitutionQuery] = useState('');

  const dispatch = useDispatch()

  const orgUnitsData = useSelector((state) => state.orgUnitsData)
  const institutionsData = useSelector((state) => state.institutionsData)

  useEffect(() => {
    dispatch(institutionsFetchAllData())
    dispatch(orgUnitsFetchAllData())
},[])

  const clearFilters = () => {
    setSearchQuery('');
    setOrgUnitQuery('');
    setInstitutionQuery('');
  }


  const CssTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ced4da',
      padding: '.375rem .75rem',
      '& fieldset': {
        top: '0px',
      },
      '&:hover fieldset': {
        borderColor: '#ced4da',
      },
    },
  });

  return (
    <Container>
      <Form>
        <Form.Group>
          <Form.Label>Name or CWID(s)</Form.Label>
          <InputGroup>
            <Form.Control type="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}></Form.Control>
          </InputGroup>
          <Row className="mt-3 mb-3"> 
            <Col md={4}>
              <Form.Label>Organizational unit(s)</Form.Label>
              <Autocomplete
                freeSolo
                id="organizational units"
                disableClearable
                options={orgUnitsData.map((option) => option.primaryOrganizationalUnit)}
                onChange={(event, value) => console.log(value)}
                renderInput={(params) => (
                  <CssTextField
                    variant = "outlined"
                    {...params}
                    InputProps={{
                      ...params.InputProps,
                      type: 'search',
                    }}
                  />
                )}
              />
            </Col>
            <Col md={4}><Form.Label>Institution(s)</Form.Label>
              <Autocomplete
                  freeSolo
                  id="organizational units"
                  disableClearable
                  options={institutionsData.map((option) => option.primaryInstitution)}
                  onChange={(event, value) => console.log(value)}
                  renderInput={(params) => (
                    <CssTextField
                      variant = "outlined"
                      {...params}
                      InputProps={{
                        ...params.InputProps,
                        type: 'search',
                      }}
                    />
                  )}
                />
            </Col>
          </Row>
          <div className="d-flex flex-row align-items-center">
            <Button className="primary" onClick={props.searchData}>Search</Button>
            <div className={`m-3 ${styles.textButton}`} onClick={clearFilters}>Reset</div>
          </div>
        </Form.Group>
      </Form>
    </Container>
  )
}

export default SearchBar;