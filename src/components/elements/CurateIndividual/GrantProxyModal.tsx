import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import styles from './GrantProxyModal.module.css';

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
        if (show && personIdentifier) {
            loadExisting();
        }
        if (!show) {
            // Reset state when modal closes
            setSearchResults([]);
            setSearchLoading(false);
            setSelectedUsers([]);
            setExistingUsers([]);
            setLoadingExisting(false);
            setLoadError(false);
            setSaving(false);
            if (searchTimer.current) {
                clearTimeout(searchTimer.current);
                searchTimer.current = null;
            }
        }
    }, [show, personIdentifier]);

    const loadExisting = async () => {
        setLoadingExisting(true);
        setLoadError(false);
        try {
            const res = await fetch(
                `/api/db/admin/proxy?personIdentifier=${encodeURIComponent(personIdentifier)}`,
                {
                    headers: {
                        'Authorization': reciterConfig.backendApiKey,
                    },
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ProxyUser[] = await res.json();
            setExistingUsers(data);
            setSelectedUsers(data);
        } catch (err) {
            console.error('[GrantProxyModal] loadExisting error:', err);
            setLoadError(true);
        } finally {
            setLoadingExisting(false);
        }
    };

    const handleSearch = (query: string) => {
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }
        if (!query || query.length < 2) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/db/admin/proxy/search-users?q=${encodeURIComponent(query)}`,
                    {
                        headers: {
                            'Authorization': reciterConfig.backendApiKey,
                        },
                    }
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Handle both flat and nested Sequelize response formats
                const users: ProxyUser[] = data.map((item: any) => ({
                    userID: item.userID,
                    personIdentifier: item.personIdentifier || '',
                    nameFirst: item.nameFirst || '',
                    nameMiddle: item.nameMiddle || '',
                    nameLast: item.nameLast || '',
                }));
                setSearchResults(users);
            } catch (err) {
                console.error('[GrantProxyModal] search error:', err);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const formatUserLabel = (user: ProxyUser): string => {
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
                    'Authorization': reciterConfig.backendApiKey,
                },
                body: JSON.stringify({
                    personIdentifier,
                    userIds: selectedUsers.map((u) => u.userID),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success(
                'Proxy access updated. Changes take effect on the user\'s next login.',
                { position: 'top-right', autoClose: 5000, theme: 'colored' }
            );
            onSave();
            onHide();
        } catch (err) {
            console.error('[GrantProxyModal] save error:', err);
            toast.error(
                'Failed to update proxy access. Please try again.',
                { position: 'top-right', autoClose: 5000, theme: 'colored' }
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        onHide();
    };

    // Filter out already-selected users from search results
    const filteredResults = searchResults.filter(
        (sr) => !selectedUsers.some((su) => su.userID === sr.userID)
    );

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: 13, fontWeight: 600, color: '#1a2133' }}>
                    Manage Proxy Access
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className={styles.subtitle}>for {personName}</div>

                {loadingExisting ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                        <Loader />
                    </div>
                ) : loadError ? (
                    <div className={styles.errorState}>
                        Unable to load proxy data. Please close and try again.
                    </div>
                ) : (
                    <>
                        <Autocomplete
                            multiple
                            disablePortal
                            options={filteredResults}
                            getOptionLabel={formatUserLabel}
                            filterOptions={(x) => x}
                            value={selectedUsers}
                            loading={searchLoading}
                            noOptionsText="No users found matching your search."
                            isOptionEqualToValue={(option, value) => option.userID === value.userID}
                            onChange={(_event, newValue) => {
                                setSelectedUsers(newValue as ProxyUser[]);
                            }}
                            onInputChange={(_event, value, reason) => {
                                if (reason === 'input') {
                                    handleSearch(value);
                                }
                            }}
                            renderTags={(value, getTagProps) =>
                                value.map((user, index) => {
                                    const { key, ...tagProps } = getTagProps({ index });
                                    return (
                                        <span
                                            key={key}
                                            {...tagProps}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                background: '#1a2133',
                                                color: '#fff',
                                                borderRadius: 20,
                                                padding: '3px 10px',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                margin: '2px 4px 2px 0',
                                            }}
                                        >
                                            {formatUserLabel(user)}
                                            <span
                                                onClick={tagProps.onDelete}
                                                style={{
                                                    cursor: 'pointer',
                                                    fontSize: 16,
                                                    lineHeight: 1,
                                                    marginLeft: 4,
                                                    opacity: 0.7,
                                                }}
                                            >
                                                &times;
                                            </span>
                                        </span>
                                    );
                                })
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    placeholder="Search users by name or CWID..."
                                    size="small"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            background: '#fff',
                                            '& fieldset': {
                                                borderColor: '#ddd7ce',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#ddd7ce',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#2563a8',
                                                borderWidth: 2,
                                            },
                                        },
                                    }}
                                />
                            )}
                        />
                        {existingUsers.length === 0 && selectedUsers.length === 0 && (
                            <div className={styles.emptyState}>
                                No users currently have proxy access for this person.
                            </div>
                        )}
                    </>
                )}
            </Modal.Body>
            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.btnDiscard}
                    onClick={handleDiscard}
                >
                    Discard Changes
                </button>
                <button
                    type="button"
                    className={styles.btnSave}
                    onClick={handleSave}
                    disabled={saving || loadingExisting || loadError}
                >
                    {saving ? (
                        <>
                            <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                style={{ marginRight: 6 }}
                            />
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>
        </Modal>
    );
};

export default GrantProxyModal;
