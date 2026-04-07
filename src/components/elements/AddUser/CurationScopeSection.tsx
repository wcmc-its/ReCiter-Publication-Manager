import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import styles from './CurationScopeSection.module.css';

interface CurationScopeSectionProps {
    selectedPersonTypes: string[];
    onPersonTypesChange: (values: string[]) => void;
    selectedOrgUnits: string[];
    onOrgUnitsChange: (values: string[]) => void;
    personTypeOptions: string[];
    orgUnitOptions: string[];
    error?: string | null;
    baseSx: Record<string, any>;
    renderOrgTags: (value: string[], getTagProps: any) => React.ReactNode[];
}

const CurationScopeSection: React.FC<CurationScopeSectionProps> = ({
    selectedPersonTypes,
    onPersonTypesChange,
    selectedOrgUnits,
    onOrgUnitsChange,
    personTypeOptions,
    orgUnitOptions,
    error,
    baseSx,
    renderOrgTags,
}) => {
    return (
        <div className={styles.scopeSection}>
            <div className={styles.sectionTitle}>Curation Scope</div>

            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="scope-person-types">Person type(s)</label>
                <Autocomplete
                    multiple
                    disableClearable
                    id="scope-person-types"
                    value={selectedPersonTypes}
                    options={personTypeOptions}
                    onChange={(_event, value) => onPersonTypesChange(value as string[])}
                    sx={baseSx}
                    renderTags={renderOrgTags}
                    renderInput={(params) => (
                        <TextField
                            variant="outlined"
                            {...params}
                            placeholder={selectedPersonTypes.length === 0 ? "Select person types..." : ""}
                            InputProps={{
                                ...params.InputProps,
                                type: 'search',
                            }}
                        />
                    )}
                />
                <span className={styles.fieldHint}>Restrict curation to people matching these person types</span>
            </div>

            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="scope-org-units">Organizational unit(s)</label>
                <Autocomplete
                    multiple
                    disableClearable
                    id="scope-org-units"
                    value={selectedOrgUnits}
                    options={orgUnitOptions}
                    onChange={(_event, value) => onOrgUnitsChange(value as string[])}
                    sx={baseSx}
                    renderTags={renderOrgTags}
                    renderInput={(params) => (
                        <TextField
                            variant="outlined"
                            {...params}
                            placeholder={selectedOrgUnits.length === 0 ? "Select organizational units..." : ""}
                            InputProps={{
                                ...params.InputProps,
                                type: 'search',
                            }}
                        />
                    )}
                />
                <span className={styles.fieldHint}>Restrict curation to people in these organizational units</span>
            </div>

            {error && <span className={styles.errorText}>{error}</span>}
        </div>
    );
};

export default CurationScopeSection;
