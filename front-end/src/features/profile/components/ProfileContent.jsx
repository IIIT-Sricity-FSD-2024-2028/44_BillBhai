import { useEffect, useState } from "react";
import { setActiveCurrency } from "../../../shared/lib/currency.js";
import PageHeader from "../../../shared/components/common/PageHeader.jsx";
import ProfileIdentityCard from "./ProfileIdentityCard.jsx";
import ProfileDetailsCard from "./ProfileDetailsCard.jsx";
import SecurityCard from "./SecurityCard.jsx";
import SubscriptionPlanCard from "./SubscriptionPlanCard.jsx";
import RecentActivityCard from "./RecentActivityCard.jsx";
import AccountPreferencesForm from "./AccountPreferencesForm.jsx";
import { api } from "../../../shared/lib/http.js";
import { useDashboard } from "../../../shared/lib/dashboard/hooks.js";
import { ROLE_LABELS } from "../../../shared/lib/dashboard/constants.js";
import {
  getNotificationPreferenceConfig,
  normalizeNotificationPreferences,
} from "../../../shared/lib/dashboard/notifications.js";
import { useDispatch, useSelector } from "react-redux";
import { fetchMeThunk } from "../../users/usersSlice.js";
import { fetchActivityThunk } from "../activitySlice.js";

const COLUMN_STYLE = { display: "flex", flexDirection: "column", gap: "16px" };
const ACTIVITY_ROLES = [
  "superuser",
  "admin",
  "cashier",
  "inventorymanager",
  "deliveryops",
  "returnhandler",
];

function pickOption(value, options) {
  return options.includes(value) ? value : options[0];
}

function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Profile & Settings. Identity and contact details come from GET /users/me;
 * the password is changed on the server after checking the current one;
 * recent activity is this person's own entries in the activity log. Only
 * display and notification preferences are kept in the browser.
 */
export default function ProfileContent() {
  const {
    roleKey,
    users,
    inventory,
    activePlan,
    loadProfileSettingsRecord,
    saveProfileSettings,
    showToast,
    openPlanUpgrade,
    cancelSubscription,
    getProfileSubscriptionView,
    refreshData,
  } = useDashboard();

  const dispatch = useDispatch();
  const me = useSelector((state) => state.users.me);
  const error = useSelector((state) => state.users.error);
  const activityRows = useSelector((state) => state.activity.items);
  const [businessName, setBusinessName] = useState("");
  const activity = me
    ? activityRows.filter((r) => r.by === me.username).slice(0, 8)
    : [];
  const [prefs, setPrefs] = useState(() => {
    const record = loadProfileSettingsRecord();
    return {
      language: pickOption(record.language, [
        "English (India)",
        "Hindi",
        "Tamil",
      ]),
      currency: pickOption(record.currency, ["INR", "USD"]),
      timezone: pickOption(record.timezone, ["Asia/Kolkata", "UTC"]),
      dateFormat: pickOption(record.dateFormat, ["DD/MM/YYYY", "MM/DD/YYYY"]),
      notifications: { ...record.notifications },
    };
  });

  useEffect(() => {
    let alive = true;
    dispatch(fetchMeThunk());
    if (ACTIVITY_ROLES.includes(roleKey)) {
      dispatch(fetchActivityThunk({ limit: 300 }));
    }
    if (roleKey !== "superuser") {
      api("/companies/me/profile")
        .then((c) => alive && setBusinessName(c ? c.name : ""))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [dispatch, roleKey]);

  const notificationOptions = getNotificationPreferenceConfig(roleKey);
  // The plan belongs to a business: the platform super user has none of their own.
  const showPlanCard =
    roleKey === "admin" ||
    (roleKey === "superuser" &&
      Boolean(localStorage.getItem("activeBusinessId")));
  const staffCount = users.filter(
    (u) => u.roleKey !== "customer" && u.roleKey !== "superuser",
  ).length;

  const savePreferences = () => {
    saveProfileSettings({
      key: loadProfileSettingsRecord().key,
      fullName: me ? me.name : loadProfileSettingsRecord().fullName,
      email: me ? me.email : "",
      phone: me ? me.mobileNo : "",
      location: "",
      bio: "",
      language: prefs.language,
      currency: prefs.currency,
      timezone: prefs.timezone,
      dateFormat: prefs.dateFormat,
      notifications: normalizeNotificationPreferences(
        notificationOptions.reduce((acc, option) => {
          acc[option.key] = Boolean(prefs.notifications[option.key]);
          return acc;
        }, {}),
        roleKey,
      ),
    });
    setActiveCurrency(prefs.currency);
    refreshData();
    showToast("Preferences saved.");
  };

  const onDetailsSaved = (saved) => {
    dispatch(fetchMeThunk());
    // Keep the header name in step with the server.
    saveProfileSettings({
      ...loadProfileSettingsRecord(),
      fullName: saved.name,
      email: saved.email,
      phone: saved.mobileNo,
      location: "",
    });
    refreshData();
  };

  const activityItems = activity.map((a) => ({
    time: when(a.at),
    before: "",
    strong: a.entityId,
    after: ` · ${a.summary}`,
  }));

  return (
    <>
      <PageHeader title="Profile & Settings" />
      {error && (
        <p className="text-muted">Could not load your account: {error}</p>
      )}
      <section className="grid-2">
        <div style={COLUMN_STYLE}>
          <ProfileIdentityCard
            fullName={me ? me.name : loadProfileSettingsRecord().fullName}
            roleLabel={ROLE_LABELS[roleKey] || "Team Member"}
            email={me ? me.email : ""}
          />
          <ProfileDetailsCard
            me={me}
            canEdit={roleKey === "admin" || roleKey === "superuser"}
            businessName={businessName}
            onSaved={onDetailsSaved}
          />
          <SecurityCard />
        </div>
        <div style={COLUMN_STYLE}>
          {showPlanCard && (
            <SubscriptionPlanCard
              plan={activePlan}
              usersCount={staffCount}
              productsCount={inventory.length}
              renewalText={getProfileSubscriptionView().renewalText}
              onUpgrade={openPlanUpgrade}
              onCancel={cancelSubscription}
            />
          )}
          <RecentActivityCard items={activityItems} />
        </div>
      </section>
      <AccountPreferencesForm
        values={prefs}
        notificationOptions={notificationOptions}
        onFieldChange={(key, value) =>
          setPrefs((prev) => ({ ...prev, [key]: value }))
        }
        onToggleChange={(key, checked) =>
          setPrefs((prev) => ({
            ...prev,
            notifications: { ...prev.notifications, [key]: checked },
          }))
        }
        onSubmit={savePreferences}
      />
    </>
  );
}
