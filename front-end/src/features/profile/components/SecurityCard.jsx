import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changeOwnPasswordThunk } from "../../users/usersSlice.js";
import { validatePasswordCriteria } from "../../../shared/lib/dashboard/helpers.js";

const MISMATCH = "The two new passwords do not match.";

/** Change your own password. The server checks the current one first. */
export default function SecurityCard({ onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState({ text: "", ok: false });
  const dispatch = useDispatch();
  const saving = useSelector(
    (state) => state.users.passwordStatus === "loading",
  );

  const [errors, setErrors] = useState({ next: "", confirm: "" });

  const onNextChange = (value) => {
    setNext(value);
    setErrors((prev) => ({
      next: prev.next ? validatePasswordCriteria(value) || "" : "",
      confirm: confirm && value !== confirm ? MISMATCH : "",
    }));
  };

  const onConfirmChange = (value) => {
    setConfirm(value);
    setErrors((prev) => ({
      ...prev,
      confirm: value && value !== next ? MISMATCH : "",
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", ok: false });
    if (!current)
      return setMessage({ text: "Enter your current password.", ok: false });
    const nextError = validatePasswordCriteria(next) || "";
    let confirmError = "";
    if (!confirm) confirmError = "Please confirm the new password.";
    else if (confirm !== next) confirmError = MISMATCH;
    setErrors({ next: nextError, confirm: confirmError });
    if (nextError || confirmError) return undefined;
    try {
      await dispatch(
        changeOwnPasswordThunk({ currentPassword: current, newPassword: next }),
      ).unwrap();
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({
        text: "Password changed. Use it next time you sign in.",
        ok: true,
      });
      if (onDone) onDone();
    } catch (err) {
      setMessage({
        text:
          typeof err === "string"
            ? err
            : err?.message || "Could not change the password",
        ok: false,
      });
    }
  };

  return (
    <div className="card">
      <div className="card-hd">
        <h3>Change password</h3>
      </div>
      <form className="card-bd" onSubmit={submit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="psCurrentPassword">
            Current password
          </label>
          <input
            type="password"
            id="psCurrentPassword"
            className="form-control"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className={errors.next ? "form-group has-error" : "form-group"}>
          <label className="form-label" htmlFor="psNewPassword">
            New password
          </label>
          <input
            type="password"
            id="psNewPassword"
            className={errors.next ? "form-control error" : "form-control"}
            placeholder="Min 6 chars (letter and number)"
            autoComplete="new-password"
            value={next}
            onChange={(e) => onNextChange(e.target.value)}
          />
          {errors.next ? (
            <div className="form-error" style={{ display: "block" }}>
              {errors.next}
            </div>
          ) : (
            <small
              className="text-muted"
              style={{
                display: "block",
                marginTop: "6px",
                fontSize: "0.75rem",
              }}
            >
              Minimum 6 characters, including 1 letter and 1 number.
            </small>
          )}
        </div>
        <div className={errors.confirm ? "form-group has-error" : "form-group"}>
          <label className="form-label" htmlFor="psConfirmPassword">
            Confirm new password
          </label>
          <input
            type="password"
            id="psConfirmPassword"
            className={errors.confirm ? "form-control error" : "form-control"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
          />
          {errors.confirm && (
            <div className="form-error" style={{ display: "block" }}>
              {errors.confirm}
            </div>
          )}
        </div>
        {message.text && (
          <p
            className="text-sm"
            role="status"
            style={{
              color: message.ok ? "var(--green)" : "var(--red)",
              margin: "0 0 10px",
            }}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-outline"
          id="psPasswordBtn"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={saving}
        >
          {saving ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
