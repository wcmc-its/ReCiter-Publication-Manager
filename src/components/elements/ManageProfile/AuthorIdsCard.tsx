import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import styles from './ManageProfile.module.css';
import { reciterConfig } from "../../../../config/local";
import { reportError } from "../../../utils/reportError";
import { showUndoToast } from "../ToastHost/ToastHost";
import Loader from "../Common/Loader";
import {
    AUTHOR_ID_TYPES, AUTHOR_ID_TYPE_LABEL, AuthorIdAction, AuthorIdRow, AuthorIdType,
    authorIdEvidenceLine, authorIdStatusLabel, authorIdUrl, normalizeAuthorId, reverseAction, rowUndoLabel, sortAuthorIds,
} from "../../../utils/authorIds";

const headers = {
    Accept: 'application/json',
    "Content-Type": "application/json",
    'Authorization': reciterConfig.backendApiKey,
};

const CHIP_CLASS: Record<string, string> = {
    'Suggested': styles.aidChipSuggested,
    'Confirmed': styles.aidChipConfirmed,
    'Confirmed (auto)': styles.aidChipConfirmed,
    'Rejected': styles.aidChipRejected,
};

const ACTION_DONE: Record<AuthorIdAction, string> = {
    confirm: 'Confirmed', reject: 'Rejected', undo: 'Returned to suggested', add: 'Added',
};

type Load = { available: boolean, canEdit: boolean, ids: AuthorIdRow[] };

// "Author profiles" on Manage Profile (3f): the person's Scopus Author IDs and OpenAlex author
// ids from reciterdb.person_author_id. Renders nothing when the table is absent (a reciterdb
// the v3.8 DDL has not reached) or the read fails, so the ORCID page above is unaffected.
const AuthorIdsCard = ({ uid }: { uid: string }) => {
    const [data, setData] = useState<Load | null>(null);
    const [busy, setBusy] = useState<string>('');
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [addType, setAddType] = useState<AuthorIdType>('SCOPUS_AUID');
    const [addValue, setAddValue] = useState('');
    const [addError, setAddError] = useState('');

    useEffect(() => {
        if (!uid) return;
        let live = true;
        setData(null);
        fetch(`/api/db/author-ids/${encodeURIComponent(uid)}`, { credentials: "same-origin", method: 'GET', headers })
            .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then((d) => { if (live) setData({ available: !!d.available, canEdit: !!d.canEdit, ids: d.ids || [] }); })
            .catch((e) => {
                // Optional card: a failed read hides it rather than blocking the page.
                console.error("[ERR-1014]", e);
                reportError("ERR-1014", "Unable to load author profiles", e);
                if (live) setData({ available: false, canEdit: false, ids: [] });
            });
        return () => { live = false; };
    }, [uid]);

    const key = (t: string, v: string) => `${t}:${v}`;

    const replace = (idType: AuthorIdType, idValue: string, row: AuthorIdRow | null) =>
        setData((d) => d && ({
            ...d,
            ids: sortAuthorIds([...d.ids.filter((r) => key(r.idType, r.idValue) !== key(idType, idValue)), ...(row ? [row] : [])]),
        }));

    const post = async (action: AuthorIdAction, idType: AuthorIdType, idValue: string): Promise<AuthorIdRow | null> => {
        const r = await fetch(`/api/db/author-ids/${encodeURIComponent(uid)}`, {
            credentials: "same-origin", method: 'POST', headers, body: JSON.stringify({ action, idType, idValue }),
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b?.message || `HTTP ${r.status}`);
        return b.row ?? null;
    };

    const act = async (action: AuthorIdAction, idType: AuthorIdType, idValue: string) => {
        const k = key(idType, idValue);
        const prev = data?.ids.find((r) => key(r.idType, r.idValue) === k) || null;
        setBusy(k);
        try {
            const row = await post(action, idType, idValue);
            replace(idType, idValue, row);
            if (action === 'add') { setAddValue(''); setAddError(''); }
            // Undo puts the row back the way it was: a removed curator-added id is re-added.
            const back: AuthorIdAction = prev && !row ? 'add' : reverseAction(prev);
            showUndoToast(`${ACTION_DONE[action]} ${AUTHOR_ID_TYPE_LABEL[idType]} ${idValue}`, () => {
                post(back, idType, idValue)
                    .then((r2) => replace(idType, idValue, r2))
                    .catch((e) => toast.error("Could not undo: " + (e.message || e)));
            });
        } catch (e: any) {
            if (action === 'add') setAddError(e.message || String(e));
            else toast.error("Could not save: " + (e.message || e));
        } finally {
            setBusy('');
        }
    };

    const onAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const v = normalizeAuthorId(addType, addValue);
        if (!v) {
            setAddError(addType === 'SCOPUS_AUID'
                ? 'A Scopus Author ID is digits only'
                : 'An OpenAlex author id is A followed by digits');
            return;
        }
        act('add', addType, v);
    };

    if (data === null) {
        return (
            <div className={styles.section} aria-busy="true">
                <div className={styles.sectionLabel}>Author profiles</div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><Loader /></div>
            </div>
        );
    }
    if (!data.available) return null;
    const { canEdit, ids } = data;

    return (
        <div className={styles.section} data-testid="author-ids-card">
            <div className={styles.sectionLabel}>Author profiles</div>
            <div className={styles.manualCard}>
                <div className={styles.manualHead}>Scopus and OpenAlex author profiles</div>
                <div className={styles.manualBody}>
                    <p className={styles.aidIntro}>
                        Suggested from the author ids on this person&apos;s accepted papers. Confirmed ids are used to
                        find publications that are not in PubMed.
                    </p>
                    {AUTHOR_ID_TYPES.map((t) => {
                        const rows = ids.filter((r) => r.idType === t);
                        return (
                            <div key={t} className={styles.aidGroup}>
                                <div className={styles.aidGroupHead}>{AUTHOR_ID_TYPE_LABEL[t]}</div>
                                {rows.length === 0 ? (
                                    <div className={styles.aidNone}>None yet</div>
                                ) : rows.map((r) => {
                                    const k = key(r.idType, r.idValue);
                                    const label = authorIdStatusLabel(r);
                                    const evidence = authorIdEvidenceLine(r);
                                    const undoLabel = rowUndoLabel(r);
                                    const disabled = busy === k;
                                    return (
                                        <div key={k} className={styles.aidRow} data-status={r.status}>
                                            <div className={styles.aidMain}>
                                                <a className={styles.aidValue} href={authorIdUrl(r.idType, r.idValue)} target="_blank" rel="noreferrer">{r.idValue}</a>
                                                <span className={`${styles.aidChip} ${CHIP_CLASS[label] || ''}`}>{label}</span>
                                                {evidence && <span className={styles.aidEvidence}>{evidence}</span>}
                                                {r.pmids.length > 0 && (
                                                    <button type="button" className={styles.aidLink} aria-expanded={!!open[k]}
                                                        onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))}>
                                                        {open[k] ? 'Hide PMIDs' : `PMIDs (${r.pmids.length})`}
                                                    </button>
                                                )}
                                                {r.conflictUid && r.status !== 'REJECTED' && (
                                                    <div className={styles.aidWarn}>Also held by {r.conflictUid}</div>
                                                )}
                                                {r.decidedBy && r.status !== 'SUGGESTED' && (
                                                    <div className={styles.aidMeta}>
                                                        {r.decidedBy === 'nightly' ? 'Confirmed by the nightly' : `By ${r.decidedBy}`}
                                                        {r.decidedAt && <> · {r.decidedAt.slice(0, 10)}</>}
                                                    </div>
                                                )}
                                                {open[k] && (
                                                    <div className={styles.aidPmids}>
                                                        {r.pmids.map((p) => (
                                                            <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer">{p}</a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <div className={styles.aidActions}>
                                                    {r.status !== 'CONFIRMED' && (
                                                        <button type="button" className={styles.btnUse} disabled={disabled}
                                                            onClick={() => act('confirm', r.idType, r.idValue)}>Confirm</button>
                                                    )}
                                                    {r.status !== 'REJECTED' && (
                                                        <button type="button" className={styles.btnRemove} disabled={disabled}
                                                            onClick={() => act('reject', r.idType, r.idValue)}>Not this person</button>
                                                    )}
                                                    {undoLabel && (
                                                        <button type="button" className={styles.aidLink} disabled={disabled}
                                                            onClick={() => act('undo', r.idType, r.idValue)}>{undoLabel}</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {canEdit && (
                        <form className={styles.aidAdd} onSubmit={onAdd}>
                            <div className={styles.fieldLabel}>Add an id</div>
                            <div className={styles.fieldRow}>
                                <select className={styles.aidSelect} aria-label="Id type" value={addType}
                                    onChange={(e) => { setAddType(e.target.value as AuthorIdType); setAddError(''); }}>
                                    {AUTHOR_ID_TYPES.map((t) => <option key={t} value={t}>{AUTHOR_ID_TYPE_LABEL[t]}</option>)}
                                </select>
                                <input className={styles.fieldInput} type="text" aria-label="Author id" value={addValue}
                                    placeholder={addType === 'SCOPUS_AUID' ? 'Scopus Author ID (digits)' : 'OpenAlex author id (A…)'}
                                    onChange={(e) => { setAddValue(e.target.value); setAddError(''); }} />
                                <button type="submit" className={styles.btnSave} disabled={!addValue.trim() || !!busy}>Add</button>
                            </div>
                            {addError && <div className={styles.errorText} role="alert">{addError}</div>}
                            <div className={styles.orcidFormatHint}>
                                Scopus: digits only. OpenAlex: A followed by digits. A profile URL also works.
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthorIdsCard;
