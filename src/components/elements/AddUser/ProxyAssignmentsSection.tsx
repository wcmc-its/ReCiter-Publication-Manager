import React, { useState, useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import { reciterConfig } from '../../../../config/local';
import styles from './ProxyAssignmentsSection.module.css';

interface PersonOption {
    personIdentifier: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    primaryOrganizationalUnit?: string;
}

interface ProxyAssignmentsSectionProps {
    selectedProxies: PersonOption[];
    onProxiesChange: (values: PersonOption[]) => void;
    baseSx: Record<string, any>;
    renderOrgTags?: (value: string[], getTagProps: any) => React.ReactNode[];
}

const ProxyAssignmentsSection: React.FC<ProxyAssignmentsSectionProps> = ({
    selectedProxies,
    onProxiesChange,
    baseSx,
}) => {
    const [searchResults, setSearchResults] = useState<PersonOption[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = (query: string) => {
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }

        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearchLoading(true);

        searchTimer.current = setTimeout(() => {
            fetch(`/api/db/admin/proxy/search-persons?q=${encodeURIComponent(query.trim())}`, {
                headers: { Authorization: reciterConfig?.backendApiKey || '' },
            })
                .then((r) => r.json())
                .then((data) => {
                    setSearchResults(data || []);
                })
                .catch((err) => {
                    console.log('Error searching persons:', err);
                    setSearchResults([]);
                })
                .finally(() => {
                    setSearchLoading(false);
                });
        }, 300);
    };

    /* SVG close icon for proxy tokens */
    const xSvg = (
        <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 8, height: 8, pointerEvents: 'none' }}>
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
        </svg>
    );

    return (
        <div className={styles.proxySection}>
            <div className={styles.sectionTitle}>Proxy Assignments</div>

            <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="proxy-assignments">People this user can curate on behalf of</label>
                <Autocomplete
                    multiple
                    id="proxy-assignments"
                    options={searchResults}
                    value={selectedProxies}
                    getOptionLabel={(option: PersonOption) =>
                        `${option.lastName}, ${option.firstName} (${option.personIdentifier})`
                    }
                    isOptionEqualToValue={(option: PersonOption, value: PersonOption) =>
                        option.personIdentifier === value.personIdentifier
                    }
                    onInputChange={(_event, value, reason) => {
                        if (reason === 'input') {
                            handleSearch(value);
                        }
                    }}
                    onChange={(_event, value) => onProxiesChange(value as PersonOption[])}
                    loading={searchLoading}
                    noOptionsText="No matching people found"
                    filterOptions={(x) => x}
                    sx={baseSx}
                    renderTags={(value: PersonOption[], getTagProps) =>
                        value.map((option, index) => {
                            const { key, onDelete } = getTagProps({ index });
                            return (
                                <span
                                    key={key}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        background: '#eeeae4',
                                        color: '#5a6478',
                                        border: '1px solid #ddd7ce',
                                        borderRadius: 20,
                                        fontSize: '12.5px',
                                        fontWeight: 500,
                                        padding: '4px 8px 4px 12px',
                                    }}
                                >
                                    {`${option.firstName} ${option.lastName} (${option.personIdentifier})`}
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        style={{
                                            width: 16,
                                            height: 16,
                                            background: 'rgba(0,0,0,0.06)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            color: '#8a94a6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            padding: 0,
                                            flexShrink: 0,
                                            transition: 'background 0.12s, color 0.12s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.12)';
                                            e.currentTarget.style.color = '#5a6478';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
                                            e.currentTarget.style.color = '#8a94a6';
                                        }}
                                    >
                                        {xSvg}
                                    </button>
                                </span>
                            );
                        })
                    }
                    renderInput={(params) => (
                        <TextField
                            variant="outlined"
                            {...params}
                            placeholder={selectedProxies.length === 0 ? "Search people to add as proxies..." : ""}
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {searchLoading ? <CircularProgress color="inherit" size={18} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                />
                <span className={styles.fieldHint}>
                    Search by name or CWID. Proxy assignments allow this user to curate publications for the selected people.
                </span>
            </div>
        </div>
    );
};

export default ProxyAssignmentsSection;
