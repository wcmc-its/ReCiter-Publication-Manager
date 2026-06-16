import React from 'react';
import { Form } from 'react-bootstrap';
import Autocomplete from '@mui/material/Autocomplete';
import styles from './CurationScopeSection.module.css';

interface CurationScopeSectionProps {
  selectedPersonTypes: string[];
  onPersonTypesChange: (values: string[]) => void;
  selectedDepartments: string[];
  onDepartmentsChange: (values: string[]) => void;
  personTypeOptions: string[];
  departmentOptions: string[];
  error: string | null;
  CssTextField: any;
}

const CurationScopeSection: React.FC<CurationScopeSectionProps> = ({
  selectedPersonTypes,
  onPersonTypesChange,
  selectedDepartments,
  onDepartmentsChange,
  personTypeOptions,
  departmentOptions,
  error,
  CssTextField,
}) => {
  return (
    <fieldset className={styles.scopeSection}>
      <legend>Curation Scope</legend>
      <p className={styles.helperText}>
        Define which people this curator can manage. At least one field is required.
      </p>

      <Form.Group className="mb-3" controlId="scopePersonTypes">
        <Form.Label>Person Types</Form.Label>
        <Autocomplete
          freeSolo
          multiple
          id="scopePersonTypes"
          disableClearable
          value={selectedPersonTypes}
          options={personTypeOptions}
          onChange={(event, value) => onPersonTypesChange(value as string[])}
          renderInput={(params) => (
            <CssTextField
              variant="outlined"
              {...params}
              InputProps={{
                ...params.InputProps,
                type: 'search',
              }}
              inputProps={{
                ...params.inputProps,
                'aria-label': 'Person Types',
              }}
              placeholder="Search person types..."
            />
          )}
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="scopeOrgUnits">
        <Form.Label>Organizational Units</Form.Label>
        <Autocomplete
          freeSolo
          multiple
          id="scopeOrgUnits"
          disableClearable
          value={selectedDepartments}
          options={departmentOptions}
          onChange={(event, value) => onDepartmentsChange(value as string[])}
          renderInput={(params) => (
            <CssTextField
              variant="outlined"
              {...params}
              InputProps={{
                ...params.InputProps,
                type: 'search',
              }}
              inputProps={{
                ...params.inputProps,
                'aria-label': 'Organizational Units',
              }}
              placeholder="Search organizational units..."
            />
          )}
        />
      </Form.Group>

      {error && (
        <div role="alert" className={styles.errorText}>
          {error}
        </div>
      )}
    </fieldset>
  );
};

export default CurationScopeSection;
