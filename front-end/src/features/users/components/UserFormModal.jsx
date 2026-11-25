import { useEffect, useState } from "react";
import Modal from "../../../shared/components/common/Modal.jsx";
import FormField, { controlClass } from "../../../shared/components/common/FormField.jsx";
import { errorText } from "../../../shared/lib/http.js";
import { useDispatch, useSelector } from "react-redux";
import {
  createUserThunk,
  updateUserThunk,
} from "../usersSlice.js";
import { useDashboard, useSession } from "../../../shared/lib/dashboard/hooks.js";
import {
  ALL_ROLES,
  STAFF_ROLES,
  roleLabel,
  suggestUsername,
} from "../../../shared/lib/dashboard/credentials.js";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;
const EMPTY = {
  name: "",
  email: "",
  role: "",
  phone: "",
  username: "",
  status: "Active",
};
const ERROR_BOX = {
  color: "var(--red)",
  marginTop: "8px",
  fontSize: "0.85rem",
};

function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2)
    errors.name = "Enter the full name (at least 2 letters).";
  if (!EMAIL_RE.test(values.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!/^[6-9]\d{9}$/.test(values.phone.replace(/\D/g, "").slice(-10)))
    errors.phone = "Enter a 10-digit mobile number.";
  if (!values.role) errors.role = "Choose a role.";
  if (!USERNAME_RE.test(values.username.trim())) {
    errors.username =
      "3-40 letters, digits, dot, dash or underscore. No spaces.";
  }
  return errors;
}

/**
 * Add or edit a staff account. A new account gets a temporary password from
 * the server, shown once afterwards; the browser never sets or stores one.
 */
export default function UserFormModal({ user, onClose }) {
  const {
    roleKey,
    users,
    activePlan,
    showToast,
    showCredentialsModal,
    refreshData,
  } = useDashboard();
  const { activeBusinessId } = useSession();
  const editing = Boolean(user && user.id);
  const [values, setValues] = useState(EMPTY);
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const dispatch = useDispatch();
  const saving = useSelector((state) => state.users.saving);

  useEffect(() => {
    setValues(
      editing
        ? {
            name: user.name,
            email: user.email,
            role: user.roleKey,
            phone: user.phone,
            username: user.username,
            status: user.status === "Suspended" ? "Suspended" : "Active",
          }
        : EMPTY,
    );
    setTouchedUsername(editing);
    setErrors({});
    setServerError("");
  }, [user, editing]);

  const roles = roleKey === "superuser" ? ALL_ROLES : STAFF_ROLES;
  const features = (activePlan && activePlan.features) || {};
  const locked = (key) =>
    (key === "deliveryops" && !features.delivery) ||
    (key === "returnhandler" && !features.returns);

  const set = (key) => (e) => {
    const next = { ...values, [key]: e.target.value };
    if (!editing && !touchedUsername && (key === "name" || key === "email")) {
      next.username = suggestUsername(users, next.name, next.email);
    }
    setValues(next);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role,
      mobileNo: values.phone.replace(/\D/g, "").slice(-10),
      username: values.username.trim(),
      status: values.status,
    };
    try {
      if (editing) {
        await dispatch(
          updateUserThunk({
            id: user.id,
            body: { ...body, version: user.version },
          }),
        ).unwrap();
        await refreshData();
        showToast(`${body.name} updated`);
        onClose();
        return;
      }
      if (roleKey === "superuser") {
        if (!activeBusinessId) {
          setServerError(
            "Open a business first (Super User Portal → the business → Manage users).",
          );
          return;
        }
        body.companyId = activeBusinessId;
      }
      const created = await dispatch(createUserThunk(body)).unwrap();
      await refreshData();
      onClose();
      showCredentialsModal("User Added", {
        name: created.name,
        username: created.username,
        password: created.temporaryPassword,
        role: roleLabel(created.role),
      });
    } catch (err) {
      setServerError(
        typeof err === "string" ? err : errorText(err, "Could not save the user"),
      );
    }
  };

  const field = (key, label, props = {}) => (
    <FormField
      label={label}
      htmlFor={`user_${key}`}
      error={errors[key] || ""}
      invalid={errors[key] ? true : undefined}
    >
      <input
        id={`user_${key}`}
        className={controlClass(Boolean(errors[key]))}
        value={values[key]}
        onChange={set(key)}
        {...props}
      />
    </FormField>
  );

  return (
    <Modal
      open
      id="addUserModal"
      title={editing ? `Edit ${user.name}` : "Add New User"}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {field("name", "Full name *", { maxLength: 80, autoComplete: "off" })}
          {field("email", "Email *", {
            type: "email",
            maxLength: 120,
            autoComplete: "off",
          })}
          {field("phone", "Mobile number *", {
            inputMode: "numeric",
            maxLength: 14,
            placeholder: "98XXXXXXXX",
          })}
          <FormField
            label="Role *"
            htmlFor="user_role"
            error={errors.role || ""}
            invalid={errors.role ? true : undefined}
          >
            <select
              id="user_role"
              className={controlClass(Boolean(errors.role))}
              value={values.role}
              onChange={set("role")}
            >
              <option value="">Choose a role</option>
              {roles.map(([key, label]) => (
                <option key={key} value={key} disabled={locked(key)}>
                  {label}
                  {locked(key) ? " (needs a higher plan)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Username *"
            htmlFor="user_username"
            error={errors.username || ""}
            invalid={errors.username ? true : undefined}
            hint={
              editing
                ? undefined
                : "Suggested from the name; change it if you like."
            }
          >
            <input
              id="user_username"
              className={controlClass(Boolean(errors.username))}
              value={values.username}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => {
                setTouchedUsername(true);
                set("username")(e);
              }}
            />
          </FormField>
          <FormField
            label="Status"
            htmlFor="user_status"
            hint="A suspended user cannot sign in."
          >
            <select
              id="user_status"
              className="form-control"
              value={values.status}
              onChange={set("status")}
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </FormField>
          {!editing && (
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              A temporary password is created when you save and shown once, so
              you can give it to them.
            </p>
          )}
          {serverError && (
            <div style={ERROR_BOX} role="alert">
              {serverError}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save User" : "Add User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
