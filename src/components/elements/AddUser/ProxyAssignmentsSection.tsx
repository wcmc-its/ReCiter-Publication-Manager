import React, { useState, useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
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
  CssTextField: any;
}

const ProxyAssignmentsSection: React.FC<ProxyAssignmentsSectionProps> = ({
  selectedProxies,
  onProxiesChange,
  CssTextField,
}) => {
  const [searchResults, setSearchResults] = useState<PersonOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (query: string) => {
    // Clear any pending search
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce 300ms
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/db/admin/proxy/search-persons?q=${encodeURIComponent(query.trim())}`,
          {
            headers: { Authorization: reciterConfig?.backendApiKey || '' },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.log('Error searching persons for proxy:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  return (
    <fieldset className={styles.proxySection}>
      <legend>Proxy Assignments</legend>
      <p className={styles.helperText}>
        Assign specific people this user can curate beyond their scope.
      </p>
      <Autocomplete
        multiple
        options={searchResults}
        getOptionLabel={(option: PersonOption) =>
          `${option.lastName}, ${option.firstName} (${option.personIdentifier}) - ${option.primaryOrganizationalUnit || 'N/A'}`
        }
        value={selectedProxies}
        onChange={(e, value) => onProxiesChange(value as PersonOption[])}
        onInputChange={(e, value, reason) => {
          if (reason === 'input') handleSearch(value);
        }}
        loading={searchLoading}
        noOptionsText="No people found matching your search."
        isOptionEqualToValue={(option, value) =>
          option.personIdentifier === value.personIdentifier
        }
        renderInput={(params) => (
          <CssTextField
            {...params}
            placeholder="Search people..."
            label="Proxy People"
            aria-label="Proxy People"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </fieldset>
  );
};

export default ProxyAssignmentsSection;
