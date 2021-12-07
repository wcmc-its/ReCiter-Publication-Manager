import React, { useState, useEffect, useRef } from "react";
import { Button, Form, Row, Col, Container , Dropdown, InputGroup } from "react-bootstrap";
import { orgUnitsFetchAllData, institutionsFetchAllData, personTypesFetchAllData } from '../../../redux/actions/actions';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import styles from './Search.module.css'
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';
import { Identity } from "../../../../types/identity";

const SearchBar = ({ 
  searchData 
} : { 
  searchData: (
    searchQuery: string, 
    orgUnitQuery: Array<string>, 
    insitutionQuery: Array<string>
  ) => void;}) => {

  const [searchQuery, setSearchQuery] = useState('');
  const [orgUnitQuery, setOrgUnitQuery] = useState<Array<string>>([]);
  const [insitutionQuery, setInstitutionQuery] = useState<Array<string>>([]);
  const [personTypeQuery, setPersonTypeQuery] = useState<Array<string>>([]);

  const dispatch = useDispatch()

  const orgUnitsData = useSelector((state: RootStateOrAny) => state.orgUnitsData)
  const institutionsData = useSelector((state: RootStateOrAny) => state.institutionsData)
  const personTypesData = useSelector((state: RootStateOrAny) => state.personTypesData)

  useEffect(() => {
    dispatch(institutionsFetchAllData())
    dispatch(orgUnitsFetchAllData())
    dispatch(personTypesFetchAllData())
},[])

  const clearFilters = () => {
    setSearchQuery('');
    setOrgUnitQuery([]);
    setInstitutionQuery([]);
    setPersonTypeQuery([]);
    searchData('', [], [], []);
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
    <Container className={styles.searchFormContainer}>
      <Form>
        <Form.Group>
          <Form.Label className={styles.searchFormLabel}>Name or CWID(s)</Form.Label>
          <InputGroup>
            <Form.Control type="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}></Form.Control>
          </InputGroup>
          <Row className="mt-3 mb-3"> 
            <Col md={4}>
              <Form.Label className={styles.searchFormLabel}>Organizational unit(s)</Form.Label>
              <Autocomplete
                freeSolo
                multiple
                id="organizational units"
                disableClearable
                value={orgUnitQuery}
                options={orgUnitsData.map((option: Identity) => option.primaryOrganizationalUnit)}
                onChange={(event, value) => setOrgUnitQuery(value as string[])}
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
            <Col md={4}><Form.Label className={styles.searchFormLabel}>Institution(s)</Form.Label>
              <Autocomplete
                  freeSolo
                  multiple
                  id="institutions"
                  disableClearable
                  value={insitutionQuery}
                  options={institutionsData.map((option: Identity) => option.primaryInstitution)}
                  onChange={(event, value) => setInstitutionQuery(value as string[])}
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
            <Col md={4}><Form.Label className={styles.searchFormLabel}>Person Type(s)</Form.Label>
              <Autocomplete
                  freeSolo
                  multiple
                  id="person-types"
                  disableClearable
                  value={personTypeQuery}
                  options={personTypesData.map((option: any) => option.personType)}
                  onChange={(event, value) => setPersonTypeQuery(value as string[])}
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
            <Col sm={2}>
              <Button className="primary w-100" onClick={() => searchData(searchQuery, orgUnitQuery, insitutionQuery, personTypeQuery)}>Search</Button>
            </Col>
            <div className={`m-3 ${styles.textButton}`} onClick={clearFilters}>Reset</div>
          </div>
        </Form.Group>
      </Form>
    </Container>
  )
}

export default SearchBar;