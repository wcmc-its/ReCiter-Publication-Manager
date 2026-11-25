-- Third Curator_Scoped axis: admin_users.scope_institutions (JSON array of
-- person.primaryInstitution values). Canonical guarded copy lives in ReCiterDB
-- setup/alter_add_admin_user_scope_institutions_v3.0.sql; run it BEFORE deploying
-- this PM build or login fails with ER_BAD_FIELD_ERROR.
ALTER TABLE admin_users
  ADD COLUMN scope_institutions JSON DEFAULT NULL AFTER scope_org_units;
