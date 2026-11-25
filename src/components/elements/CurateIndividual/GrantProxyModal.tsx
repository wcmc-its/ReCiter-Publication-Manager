import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { toast } from 'react-toastify';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import { Dialog, Button, Input } from '../../ui';
import { focusRing } from '../../ui/tokens';

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

const mutedSx = { fontSize: 13, color: 'var(--pm-muted-foreground)' };

const GrantProxyModal: React.FC<GrantProxyModalProps> = ({
    show,
    onHide,
    personIdentifier,
    personName,
    onSave,
}) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProxyUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<ProxyUser[]>([]);
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
            setQuery('');
            setSearchResults([]);
            setSearchLoading(false);
            setSelectedUsers([]);
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
            setSelectedUsers(data);
        } catch (err) {
            console.error('[GrantProxyModal] loadExisting error:', err);
            setLoadError(true);
        } finally {
            setLoadingExisting(false);
        }
    };

    const handleSearch = (value: string) => {
        setQuery(value);
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }
        if (!value || value.length < 2) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/db/admin/proxy/search-users?q=${encodeURIComponent(value)}`,
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

    const formatUserName = (user: ProxyUser): string =>
        [user.nameFirst, user.nameLast].filter(Boolean).join(' ') || user.personIdentifier;

    const addUser = (user: ProxyUser) => {
        setSelectedUsers((prev) => [...prev, user]);
    };

    const removeUser = (userID: number) => {
        setSelectedUsers((prev) => prev.filter((u) => u.userID !== userID));
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
                'Proxy access updated. Changes take effect on the user\'s next login.');
            onSave();
            onHide();
        } catch (err) {
            console.error('[GrantProxyModal] save error:', err);
            toast.error(
                'Failed to update proxy access. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Filter out already-selected users from search results
    const filteredResults = searchResults.filter(
        (sr) => !selectedUsers.some((su) => su.userID === sr.userID)
    );
    const searching = query.trim().length >= 2;

    return (
        <Dialog
            open={show}
            onClose={onHide}
            width={560}
            title="Manage proxy access"
            description={`for ${personName} · proxies can curate their publications`}
            footer={
                <>
                    <Button onClick={onHide}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving || loadingExisting || loadError}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </>
            }
        >
            {loadingExisting ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                    <Loader />
                </Box>
            ) : loadError ? (
                <Box role="alert" sx={{ fontSize: 13, color: 'var(--pm-red)' }}>
                    Unable to load proxy data. Please close and try again.
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', minHeight: 26 }}>
                        {selectedUsers.length === 0 && (
                            <Box component="span" sx={mutedSx}>
                                No proxies yet.
                            </Box>
                        )}
                        {selectedUsers.map((user) => (
                            <Box
                                component="span"
                                key={user.userID}
                                sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 26, pl: 1.25, pr: 0.375,
                                    borderRadius: 999, bgcolor: 'var(--pm-bar)', color: '#fff',
                                    fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
                                }}
                            >
                                {formatUserName(user)}{user.personIdentifier ? ` · ${user.personIdentifier}` : ''}
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() => removeUser(user.userID)}
                                    aria-label={`Remove ${formatUserName(user)}`}
                                    sx={{
                                        width: 22, height: 22, border: 0, borderRadius: '50%', bgcolor: 'transparent',
                                        color: 'inherit', opacity: 0.75, cursor: 'pointer', fontSize: 15, lineHeight: 1, p: 0,
                                        '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' },
                                        '&:focus-visible': focusRing,
                                    }}
                                >
                                    &times;
                                </Box>
                            </Box>
                        ))}
                    </Box>
                    <Input
                        autoFocus
                        placeholder="Search users by name or CWID…"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        inputProps={{ 'aria-label': 'Search users by name or CWID' }}
                        fullWidth
                    />
                    {searching && (
                        <Box sx={{
                            display: 'flex', flexDirection: 'column', maxHeight: 240, overflow: 'auto',
                            border: '1px solid var(--pm-border)', borderRadius: 'var(--radius-md)',
                        }}>
                            {searchLoading ? (
                                <Box sx={{ ...mutedSx, py: 2.25, textAlign: 'center' }}>Searching…</Box>
                            ) : filteredResults.length === 0 ? (
                                <Box sx={{ ...mutedSx, py: 2.25, textAlign: 'center' }}>No users found matching your search.</Box>
                            ) : (
                                filteredResults.map((user) => (
                                    <Box
                                        key={user.userID}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1,
                                            borderBottom: '1px solid var(--pm-border)', '&:last-of-type': { borderBottom: 0 },
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                            <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>{formatUserName(user)}</Box>
                                            <Box component="span" sx={{ fontSize: 12, color: 'var(--pm-muted-foreground)' }}>{user.personIdentifier}</Box>
                                        </Box>
                                        <Button size="sm" variant="ghost" onClick={() => addUser(user)} aria-label={`Add ${formatUserName(user)}`} sx={{ color: 'var(--pm-slate)', fontWeight: 600 }}>
                                            Add
                                        </Button>
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}
                    <Box sx={{ fontSize: 12, color: 'var(--pm-muted-foreground)' }}>
                        Any user who has logged in can be assigned as a proxy. Access takes effect on their next login.
                    </Box>
                </Box>
            )}
        </Dialog>
    );
};

export default GrantProxyModal;
