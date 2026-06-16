# Phase 17: Admin CRUD - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 17-admin-crud
**Areas discussed:** Tab layout and navigation, Role editing workflow, Permission CRUD and resources, Deletion safety guards

---

## Tab Layout and Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| MUI Tabs on same page | Add MUI Tab/TabPanel at top of ManageUsers page. No URL change, tab state local. | ✓ |
| URL-based tabs with query param | Same page but URL changes for deep-linking and browser navigation. | |
| Separate routes | New pages at /manageusers/roles and /manageusers/permissions. | |

**User's choice:** MUI Tabs on same page
**Notes:** Consistent with MUI already in the project. Users tab shows current content unchanged.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'Manage Users' | PageHeader stays as 'Manage Users' regardless of active tab. | ✓ |
| Dynamic header | Header changes based on active tab. | |
| You decide | Claude picks. | |

**User's choice:** Keep 'Manage Users'
**Notes:** Tabs already communicate context.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tab toolbars | Each tab gets contextual toolbar. Users: search/Add User. Roles: Add Role. Permissions: Add Permission. | ✓ |
| Shared toolbar | Search bar on all tabs with contextual action buttons. | |
| You decide | Claude picks. | |

**User's choice:** Per-tab toolbars
**Notes:** Search only needed on Users tab since roles/permissions lists are small.

---

## Role Editing Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Table with permission chips | Table listing roles with permissions as MUI Chips per row. Edit/Delete actions. | ✓ |
| Accordion/expandable rows | Collapsible rows showing permissions on expand. | |
| Card-based layout | Role cards in a grid with chips inside. | |

**User's choice:** Table with permission chips
**Notes:** Compact and scannable.

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with checkbox list | Modal listing all permissions as checkboxes. Check/uncheck to assign. Role name editable. Save/Cancel. | ✓ |
| Inline chip editing | Row toggles to edit mode with chip X buttons and autocomplete. | |
| Drag-and-drop | Two-column drag interface for assigning permissions. | |

**User's choice:** Modal with checkbox list
**Notes:** Clear, familiar pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Same modal, empty state | Add Role opens the same modal with empty fields. Reuses component. | ✓ |
| Separate form page | Navigate to /manageusers/add-role. | |
| You decide | Claude picks. | |

**User's choice:** Same modal, empty state
**Notes:** Consistent experience, reuses component.

---

## Permission CRUD and Resources

| Option | Description | Selected |
|--------|-------------|----------|
| Table grouped by category | Table with category grouping. Columns: key, label, category, resource count. Edit/Delete per row. | ✓ |
| Card grid by category | Category cards with permissions inside. | |
| Flat table, no grouping | Simple flat table with category column. | |

**User's choice:** Table grouped by category
**Notes:** Organized view as permissions grow.

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with resources section | Modal with read-only key, editable label/description/category, plus resources list below. | ✓ |
| Inline table editing | Row becomes editable in place with sub-table for resources. | |
| Separate form page | Dedicated edit page with full form. | |

**User's choice:** Modal with resources section
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline form row | '+ Add Resource' adds editable row at bottom. Fields: type, key, icon, label, route, order. | ✓ |
| Nested modal | Second modal on top for resource details. | |
| You decide | Claude picks. | |

**User's choice:** Inline form row
**Notes:** All changes saved together with modal Save button.

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown from existing values | Combo box populated from distinct DB categories. Allows typing new values too. | ✓ |
| Free-text input | Simple text input. | |
| You decide | Claude picks. | |

**User's choice:** Dropdown from existing values
**Notes:** Prevents typos while allowing growth.

---

## Deletion Safety Guards

| Option | Description | Selected |
|--------|-------------|----------|
| Enabled button, blocking modal | Delete always clickable. Server checks dependencies. Blocking modal if deps exist, confirm dialog if not. | ✓ |
| Disabled button with tooltip | Grayed out with tooltip when deps exist. Only enabled when safe. | |
| You decide | Claude picks. | |

**User's choice:** Enabled button, blocking modal
**Notes:** User gets clear feedback about WHY something can't be deleted.

| Option | Description | Selected |
|--------|-------------|----------|
| Show affected roles with user counts | Modal lists roles using the permission plus their user counts. | ✓ |
| Show role names only | Just role names without user counts. | |
| You decide | Claude picks. | |

**User's choice:** Show affected roles with user counts
**Notes:** Full picture of impact.

## Claude's Discretion

- API route structure and controller organization
- MUI Dialog vs React Bootstrap Modal choice
- MUI Tab variant and styling
- Loading states and error handling
- Category grouping rendering approach in Permissions table

## Deferred Ideas

None -- discussion stayed within phase scope.
