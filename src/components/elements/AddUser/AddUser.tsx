import React, { useState, FunctionComponent, useEffect } from "react"
import Autocomplete from '@mui/material/Autocomplete';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import styles from './AddUser.module.css';
import Loader from '../Common/Loader';
import TextField from '@mui/material/TextField';
import { createAdminUser, createORupdateUserIDAction, fetchUserInfoByID, getAdminDepartments, getAdminRoles} from "../../../redux/actions/actions";
import { useRouter } from "next/router";
import Link from "next/link";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';

/* ── Role label formatting ── */
const ROLE_LABELS: Record<string, string> = {
    'Superuser': 'Superuser',
    'Curator_All': 'Curator \u2014 All',
    'Curator_Self': 'Curator \u2014 Self',
    'Curator_Department': 'Curator \u2014 Department',
    'Curator_Department_Delegate': 'Curator \u2014 Department Delegate',
    'Reporter_All': 'Reporter \u2014 All',
};
const ROLE_DESCS: Record<string, string> = {
    'Superuser': 'Full access to all features and admin functions.',
    'Curator_All': 'Can curate publications for any person in the system.',
    'Curator_Self': 'Can only curate their own publications.',
    'Curator_Department': 'Can curate publications for their managed org units.',
    'Curator_Department_Delegate': 'Delegated curation access for specific departments.',
    'Reporter_All': 'Can generate and export reports for all users.',
};
const formatRoleLabel = (slug: string) => ROLE_LABELS[slug] || slug.replace(/_/g, ' ');

interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    item: any
}
type  formErrors = {[key: string]: any};

const AddUser: FunctionComponent<FuncProps> = (props) => {

    const adminDepartments = useSelector((state: RootStateOrAny) => state.AllAdminDepatments);
    const allAdminRoles = useSelector((state: RootStateOrAny) => state.AllAdminRoles);

    const [state, setState] = useState({
        cwid: "",
        email: "",
        firstName: "",
        lastName: "",
        middleName: "",
        department: "",
        division: "",
        title: "",
        description: ""
    })
    const { cwid, email, firstName, lastName, middleName, division, title} = state;
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [formErrorsInst, setformErrInst] = useState<{[key: string]: any}>({});
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    const router = useRouter()
    const isEdit = router.query.userId ? true : false;

    const dispatch = useDispatch();

    const handleValueChangeTargetValue = (field, value) => {
        if(value != '') formErrorsInst[field] = '';
        setState(state => ({ ...state, [field]: value }))
    }

    const validateEmail = (email) => {
        let mailformat = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
        return email.match(mailformat)
    };

    const checkFormValidations = () => {
        let formErrInst: formErrors = {};
        if ( !firstName || firstName === '' || firstName.trim().length === 0 ) formErrInst.firstName = 'Please enter valid first Name!'
        if ( !lastName || lastName === '' || lastName.trim().length === 0 ) formErrInst.lastName = 'Please enter valid last Name!'
        if ( !selectedRoles || selectedRoles.length === 0  ) formErrInst.selectedRole = 'Please select atleast one role!'
        setformErrInst(formErrInst)
        return formErrInst
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        const newErrors = checkFormValidations()

        if ( Object.keys(newErrors).length === 0 ) {
            let roleIds = [];
            let departMentIds = [];
            selectedRoles && selectedRoles.length > 0 && allAdminRoles.map(role => {
                selectedRoles.map((editRole) => {
                    if (editRole === role.roleLabel) roleIds.push(role.roleID)
                })
            })
            selectedDepartments && selectedDepartments.length > 0 && adminDepartments.map(department=>{
                selectedDepartments.map((selectedDep) => {
                    if (selectedDep === department.departmentLabel) departMentIds.push(department.departmentID)
                })
            })
            let selectedRoleIds = roleIds || [];
            let departmentIds = departMentIds || [];
            let isEditUserId = router.query.userId;
            let createOrUpdatePayload = { cwid, email, firstName, lastName, middleName, division, title, selectedRoleIds, departmentIds, isEditUserId }

            if (isEditUserId) {
                let resp = await createAdminUser(createOrUpdatePayload)
                if (resp && resp.length > 0 && resp[0] === 1) {
                    dispatch(createORupdateUserIDAction("UserID " + isEditUserId + " has been Updated"))
                    router.push("/admin/manage/users")
                }
            }
            else {
                let resp = await createAdminUser(createOrUpdatePayload)
                if (resp && resp.length > 0 && resp[0].userID) {
                    dispatch(createORupdateUserIDAction("UserID " + resp[0].userID + " has been Created"))
                    router.push("/admin/manage/users")
                }
            }
        }
    };

    useEffect(() => {
        dispatch(getAdminRoles());
        dispatch(getAdminDepartments());
    },[])

    useEffect(() => {
        let isEditUserId = router.query.userId;

        if (isEditUserId) {
            setLoading(true)
            let userDetails = fetchUserInfoByID(isEditUserId).then(result => {
                const { adminUsersDepartments, adminUsersRoles, email, nameFirst, nameLast, nameMiddle, personIdentifier } = result && result[0];
                if (adminUsersRoles) {
                    let roleNames = [];
                    allAdminRoles.map(role => {
                        adminUsersRoles.map((editRole) => {
                            if (editRole.roleID === role.roleID) roleNames.push(role.roleLabel)
                        })
                    })
                    setSelectedRoles(roleNames ? roleNames : [])
                }

                if (adminUsersDepartments) {
                    let departmentNames = [];
                    adminDepartments.map((department) => {
                        adminUsersDepartments.map((editIds) => {
                            if (editIds.departmentID == department.departmentID) departmentNames.push(department.departmentLabel)
                        })
                    })
                    setSelectedDepartments(departmentNames ? departmentNames : [])
                }

                setState(state => ({ ...state, cwid: personIdentifier, lastName: nameLast, firstName: nameFirst, email, middleName: nameMiddle }))
                setLoading(false)
            })
        }
    }, [router.query.userId])

    /* Base input styling shared by both Autocompletes */
    const baseSx = {
        '& .MuiOutlinedInput-root': {
            padding: '4px 8px',
            background: '#fff',
            borderRadius: '5px',
            fontSize: '13px',
            fontFamily: 'inherit',
            '& fieldset': {
                borderColor: '#ddd7ce',
                top: 0,
                '& legend': { display: 'none' },
            },
            '&:hover fieldset': { borderColor: '#ddd7ce' },
            '&.Mui-focused fieldset': {
                borderColor: '#2563a8',
                borderWidth: '1px',
                boxShadow: '0 0 0 3px rgba(37,99,168,0.1)',
            },
        },
    };

    /* Org-unit & Role Autocomplete share base input styling only */
    const orgUnitSx = { ...baseSx };
    const roleSx = { ...baseSx };

    /* SVG × icon shared by both token types */
    const xSvg = (
        <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 8, height: 8, pointerEvents: 'none' }}>
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
        </svg>
    );

    /* Dark token (roles) */
    const renderRoleTags = (value: string[], getTagProps: any) =>
        value.map((option, index) => {
            const { key, onDelete } = getTagProps({ index });
            return (
                <span key={key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#1a2133', color: '#fff', borderRadius: 20,
                    fontSize: '12.5px', fontWeight: 500, padding: '4px 8px 4px 12px',
                }}>
                    {formatRoleLabel(option)}
                    <button type="button" onClick={onDelete} style={{
                        width: 16, height: 16, background: 'rgba(255,255,255,0.18)',
                        border: 'none', borderRadius: '50%', color: 'rgba(255,255,255,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 0.12s, color 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    >{xSvg}</button>
                </span>
            );
        });

    /* Light token (org units) */
    const renderOrgTags = (value: string[], getTagProps: any) =>
        value.map((option, index) => {
            const { key, onDelete } = getTagProps({ index });
            return (
                <span key={key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#eeeae4', color: '#5a6478', border: '1px solid #ddd7ce', borderRadius: 20,
                    fontSize: '12.5px', fontWeight: 500, padding: '4px 8px 4px 12px',
                }}>
                    {option}
                    <button type="button" onClick={onDelete} style={{
                        width: 16, height: 16, background: 'rgba(0,0,0,0.06)',
                        border: 'none', borderRadius: '50%', color: '#8a94a6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 0.12s, color 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#5a6478'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#8a94a6'; }}
                    >{xSvg}</button>
                </span>
            );
        });

    const RolePaper = (props: any) => (
        <Paper {...props} sx={{
            border: '1px solid #e8e2d9',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(26,33,51,0.14)',
            overflow: 'hidden',
            mt: '5px',
        }}>
            <div style={{
                padding: '8px 12px 10px',
                background: '#eeeae4',
                borderBottom: '1px solid #ddd7ce',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                color: '#8a94a6',
            }}>Available roles</div>
            {props.children}
        </Paper>
    );

    /* Force dropdown below the input so the search field stays on top */
    const RolePopper = (props: any) => (
        <Popper {...props} placement="bottom-start" modifiers={[{ name: 'flip', enabled: false }]} />
    );

    return (
        <>
            {/* Breadcrumb */}
            <div className={styles.breadcrumb}>
                <Link href="/admin/manage/users">Manage Users</Link>
                <svg className={styles.breadcrumbChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                </svg>
                <span>{isEdit ? 'Edit User' : 'Add User'}</span>
            </div>

            <h1 className={styles.pageTitle}>{isEdit ? 'Edit User' : 'Add User'}</h1>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader /></div>
            ) : (
                <form onSubmit={handleSubmit} noValidate>
                    <div className={styles.formCard}>
                        {/* ── Account section ── */}
                        <div className={styles.formSection}>
                            <div className={styles.formSectionTitle}>Account</div>
                            <div className={`${styles.fieldGrid} ${styles.col2}`}>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>CWID</label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={cwid}
                                        disabled={isEdit}
                                        maxLength={128}
                                        placeholder="e.g. jds2001"
                                        onChange={(e) => handleValueChangeTargetValue("cwid", e.target.value)}
                                    />
                                    {formErrorsInst.cwid && <span className={styles.errorText}>{formErrorsInst.cwid}</span>}
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Primary Email</label>
                                    <input
                                        className={styles.fieldInput}
                                        type="email"
                                        value={email}
                                        disabled={isEdit}
                                        maxLength={128}
                                        placeholder="user@med.cornell.edu"
                                        onChange={(e) => handleValueChangeTargetValue("email", e.target.value)}
                                    />
                                    {formErrorsInst.email && <span className={styles.errorText}>{formErrorsInst.email}</span>}
                                </div>
                            </div>
                        </div>

                        {/* ── Identity section ── */}
                        <div className={styles.formSection}>
                            <div className={styles.formSectionTitle}>Identity</div>
                            <div className={`${styles.fieldGrid} ${styles.col3}`}>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>First Name <span className={styles.req}>*</span></label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={firstName}
                                        maxLength={128}
                                        placeholder="Jane"
                                        onChange={(e) => handleValueChangeTargetValue("firstName", e.target.value)}
                                    />
                                    {formErrorsInst.firstName && <span className={styles.errorText}>{formErrorsInst.firstName}</span>}
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Middle Name</label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={middleName}
                                        maxLength={128}
                                        placeholder="D."
                                        onChange={(e) => handleValueChangeTargetValue("middleName", e.target.value)}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Last Name <span className={styles.req}>*</span></label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={lastName}
                                        maxLength={128}
                                        placeholder="Smith"
                                        onChange={(e) => handleValueChangeTargetValue("lastName", e.target.value)}
                                    />
                                    {formErrorsInst.lastName && <span className={styles.errorText}>{formErrorsInst.lastName}</span>}
                                </div>
                            </div>
                            <div className={`${styles.fieldGrid} ${styles.col21}`} style={{ marginTop: 16 }}>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Primary Organizational Unit</label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={division}
                                        maxLength={200}
                                        placeholder="Department of Medicine"
                                        onChange={(e) => handleValueChangeTargetValue("division", e.target.value)}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Title</label>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={title}
                                        maxLength={200}
                                        placeholder="Associate Professor"
                                        onChange={(e) => handleValueChangeTargetValue("title", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Access section ── */}
                        <div className={styles.formSection}>
                            <div className={styles.formSectionTitle}>Access</div>
                            <div className={styles.fieldGrid}>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Organizational unit(s) user can manage</label>
                                    <Autocomplete
                                        freeSolo
                                        multiple
                                        id="institutions"
                                        disableClearable
                                        value={selectedDepartments}
                                        options={adminDepartments.map((option) => option.departmentLabel)}
                                        onChange={(event, value) => setSelectedDepartments(value as string[])}
                                        sx={orgUnitSx}
                                        renderTags={renderOrgTags}
                                        renderInput={(params) => (
                                            <TextField
                                                variant="outlined"
                                                {...params}
                                                placeholder={selectedDepartments.length === 0 ? "Search and select departments..." : ""}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    type: 'search',
                                                }}
                                            />
                                        )}
                                    />
                                    <span className={styles.fieldHint}>Leave empty if user should have access to all units</span>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Role(s) <span className={styles.req}>*</span></label>
                                    <Autocomplete
                                        multiple
                                        id="roles"
                                        disableClearable
                                        disableCloseOnSelect
                                        value={selectedRoles}
                                        options={allAdminRoles.map((option) => option.roleLabel)}
                                        onChange={(event, value) => setSelectedRoles(value as string[])}
                                        getOptionLabel={(option) => formatRoleLabel(option)}
                                        sx={roleSx}
                                        PaperComponent={RolePaper}
                                        PopperComponent={RolePopper}
                                        ListboxProps={{
                                            sx: {
                                                p: 0,
                                                maxHeight: '360px',
                                                '& .MuiAutocomplete-option': {
                                                    p: '0 !important',
                                                    minHeight: 'unset !important',
                                                    '&[aria-selected="true"]': { background: 'transparent !important' },
                                                    '&.Mui-focused': { background: 'transparent !important' },
                                                },
                                            }
                                        } as any}
                                        renderTags={renderRoleTags}
                                        renderOption={(props, option, { index: optIdx }) => {
                                            const selected = selectedRoles.includes(option);
                                            const isLast = optIdx === allAdminRoles.length - 1;
                                            return (
                                                <li {...props} key={option} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '12px 14px',
                                                    borderLeft: selected ? '2px solid #2563a8' : '2px solid transparent',
                                                    borderBottom: isLast ? 'none' : '1px solid #e8e2d9',
                                                    background: selected ? '#eef3fb' : 'transparent',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#f5f2ee'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = selected ? '#eef3fb' : 'transparent'; }}
                                                >
                                                    <span style={{
                                                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: selected ? 'none' : '1.5px solid #bbb5aa',
                                                        background: selected ? '#1a2133' : 'transparent',
                                                    }}>
                                                        {selected && (
                                                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                                                <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        )}
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: '#1a2133', lineHeight: '16px' }}>{formatRoleLabel(option)}</div>
                                                        {ROLE_DESCS[option] && (
                                                            <div style={{ fontSize: '11px', color: '#8a94a6', marginTop: 2, lineHeight: 1.4 }}>{ROLE_DESCS[option]}</div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                variant="outlined"
                                                {...params}
                                                placeholder={selectedRoles.length === 0 ? "Add role\u2026" : ""}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    type: 'search',
                                                }}
                                            />
                                        )}
                                    />
                                    <span className={styles.fieldHint}>Roles control what this user can access. At least one role is required.</span>
                                    {formErrorsInst.selectedRole && <span className={styles.errorText}>{formErrorsInst.selectedRole}</span>}
                                </div>
                            </div>
                        </div>

                        {/* ── Footer ── */}
                        <div className={styles.formFooter}>
                            <button
                                type="submit"
                                className={styles.btnSubmit}
                                disabled={cwid.trim().length === 0 && !validateEmail(email)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                                {isEdit ? "Update User" : "Create User"}
                            </button>
                            <button
                                type="button"
                                className={styles.btnCancelForm}
                                onClick={() => router.push("/admin/manage/users")}
                            >
                                Cancel
                            </button>
                            <span className={styles.reqNote}><span>*</span> Required fields</span>
                        </div>
                    </div>
                </form>
            )}
            <ToastContainerWrapper />
        </>
    );
}

export default AddUser
