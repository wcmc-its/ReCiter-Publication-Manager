import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { toast } from 'react-toastify';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';

interface ProxyUser {
  userID: number;
  personIdentifier: string;
  nameFirst: string;
  nameMiddle: string;
  nameLast: string;
}

interface GrantProxyModalProps {
  show: boolean;
  onHide: () => void;
  personIdentifier: string;
  personName: string;
  onSave: () => void;
}

const GrantProxyModal: React.FC<GrantProxyModalProps> = ({
  show,
  onHide,
  personIdentifier,
  personName,
  onSave,
}) => {
  const [searchResults, setSearchResults] = useState<ProxyUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<ProxyUser[]>([]);
  const [existingUsers, setExistingUsers] = useState<ProxyUser[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      loadExisting();
    } else {
      // Reset state when modal closes
      setSearchResults([]);
      setSelectedUsers([]);
      setExistingUsers([]);
      setLoadError(false);
    }
  }, [show, personIdentifier]);

  const loadExisting = async () => {
    setLoadingExisting(true);
    setLoadError(false);
    try {
      const res = await fetch(
        `/api/db/admin/proxy?personIdentifier=${personIdentifier}`,
        { headers: { Authorization: reciterConfig.backendApiKey } }
      );
      const data = await res.json();
      setExistingUsers(data);
      setSelectedUsers(data);
    } catch (err) {
      console.log('[PROXY] Error loading existing proxies:', err);
      setLoadError(true);
    }
    setLoadingExisting(false);
  };

  const handleSearch = (query: string) => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/db/admin/proxy/search-users?q=${encodeURIComponent(query)}`,
          { headers: { Authorization: reciterConfig.backendApiKey } }
        );
        const data = await res.json();
        // Flatten nested Sequelize response to flat ProxyUser objects
        const flatUsers: ProxyUser[] = data.map((u: any) => ({
          userID: u.userID,
          personIdentifier: u.personIdentifier || '',
          nameFirst: u.nameFirst || '',
          nameMiddle: u.nameMiddle || '',
          nameLast: u.nameLast || '',
        }));
        setSearchResults(flatUsers);
      } catch (err) {
        console.log('[PROXY] Error searching users:', err);
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
  };

  const formatUserLabel = (user: ProxyUser) => {
    const name = [user.nameLast, user.nameFirst].filter(Boolean).join(', ');
    return user.personIdentifier ? `${name} (${user.personIdentifier})` : name;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/db/admin/proxy/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: reciterConfig.backendApiKey,
        },
        body: JSON.stringify({
          personIdentifier,
          userIds: selectedUsers.map((u) => u.userID),
        }),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }

      toast.success('Proxy access granted. Changes take effect on the user\'s next login.', {
        position: 'top-right',
        autoClose: 5000,
        theme: 'colored',
      });
      onSave();
      onHide();
    } catch (err) {
      console.log('[PROXY] Error saving proxy assignments:', err);
      toast.error('Unable to save proxy assignments. Please try again.', {
        position: 'top-right',
        autoClose: 5000,
        theme: 'colored',
      });
    }
    setSaving(false);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" aria-labelledby="grantProxyModalTitle">
      <Modal.Header closeButton>
        <Modal.Title id="grantProxyModalTitle" style={{ fontSize: '20px', fontWeight: 400 }}>
          Grant Proxy Access
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '16px' }}>
        <p style={{ fontSize: '14px', color: '#777777', marginBottom: '16px' }}>
          Select users who can curate publications for {personName}
        </p>
        {loadingExisting ? (
          <Loader />
        ) : loadError ? (
          <div role="alert" style={{ color: '#dc3545', fontSize: '14px' }}>
            Unable to load proxy data. Please close and try again.
          </div>
        ) : (
          <Autocomplete
            multiple
            options={searchResults}
            value={selectedUsers}
            onChange={(_event, newValue) => setSelectedUsers(newValue as ProxyUser[])}
            onInputChange={(_event, value, reason) => {
              if (reason === 'input') {
                handleSearch(value);
              }
            }}
            getOptionLabel={(option) => formatUserLabel(option as ProxyUser)}
            isOptionEqualToValue={(option, value) =>
              (option as ProxyUser).userID === (value as ProxyUser).userID
            }
            noOptionsText="No users found matching your search."
            loading={searchLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search users..."
                variant="outlined"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchLoading ? <Spinner animation="border" size="sm" /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Discard Changes
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || loadingExisting || loadError}
        >
          {saving ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Saving...
            </>
          ) : (
            'Save Proxy Assignments'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GrantProxyModal;
