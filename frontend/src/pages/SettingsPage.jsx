import { useState } from "react";
import { useTheme } from "../hooks/useTheme";

const SettingsPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Preferences</h3>
        <div className="notification-list">
          <div className="notification-item">
            <div>
              <strong>Theme Mode</strong>
              <p>
                Switch between light and dark mode. Preference is saved
                automatically.
              </p>
            </div>
            <button
              type="button"
              className={`preference-toggle ${isDark ? "on" : "off"}`}
              aria-pressed={isDark}
              onClick={toggleTheme}
            >
              {isDark ? "Use Light Theme" : "Use Dark Theme"}
            </button>
          </div>
          <div className="notification-item">
            <div>
              <strong>Email Notifications</strong>
              <p>Receive updates for approvals, comments, and escalations.</p>
            </div>
            <button
              type="button"
              className={`preference-toggle ${emailNotificationsEnabled ? "on" : "off"}`}
              aria-pressed={emailNotificationsEnabled}
              onClick={() => setEmailNotificationsEnabled((prev) => !prev)}
            >
              {emailNotificationsEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="notification-item">
            <div>
              <strong>Weekly Report</strong>
              <p>Get a weekly summary with SLA and throughput insights.</p>
            </div>
            <button
              type="button"
              className={`preference-toggle ${weeklyReportEnabled ? "on" : "off"}`}
              aria-pressed={weeklyReportEnabled}
              onClick={() => setWeeklyReportEnabled((prev) => !prev)}
            >
              {weeklyReportEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="notification-item">
            <div>
              <strong>Slack Integration</strong>
              <p>
                Future-ready integration placeholder for approval alerts to
                Slack.
              </p>
            </div>
            <button type="button" className="btn btn-outline">
              Configure
            </button>
          </div>
          <div className="notification-item">
            <div>
              <strong>Microsoft Teams Integration</strong>
              <p>
                Future-ready integration placeholder for Teams approval workflow
                notifications.
              </p>
            </div>
            <button type="button" className="btn btn-outline">
              Configure
            </button>
          </div>
        </div>
      </article>

      <article className="surface-card fade-in">
        <h3>Security</h3>
        <div className="settings-form">
          <label>
            <span>Current Password</span>
            <input type="password" placeholder="Enter current password" />
          </label>
          <label>
            <span>New Password</span>
            <input type="password" placeholder="Enter new password" />
          </label>
          <label>
            <span>Confirm New Password</span>
            <input type="password" placeholder="Confirm new password" />
          </label>
          <button type="button" className="btn btn-primary">
            Update Password
          </button>
        </div>
      </article>
    </section>
  );
};

export default SettingsPage;
