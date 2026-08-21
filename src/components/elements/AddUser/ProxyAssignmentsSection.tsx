import React, { useState, useRef } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { reciterConfig } from '../../../../config/local';

export interface PersonOption {
  personIdentifier: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  primaryOrganizationalUnit?: string;
}

interface ProxyAssignmentsSectionProps {
  selectedProxies: PersonOption[];
  onProxiesChange: (values: PersonOption[]) => void;
  sx?: any;
  renderTags?: (value: PersonOption[], getTagProps: any) => React.ReactNode;
}

// Presentational only -- the field wrapper (label/hint/layout) lives in AddUser.tsx so this
// matches the org-unit/role/scope fields around it instead of introducing its own look.
const ProxyAssignmentsSection: React.FC<ProxyAssignmentsSectionProps> = ({
  selectedProxies,
  onProxiesChange,
  sx,
  renderTags,
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
      sx={sx}
      renderTags={renderTags}
      renderInput={(params) => (
        <TextField
          variant="outlined"
          {...params}
          placeholder={selectedProxies.length === 0 ? "Search people..." : ""}
          aria-label="Proxy People"
          InputProps={{
            ...params.InputProps,
            type: 'search',
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
  );
};

export default ProxyAssignmentsSection;
