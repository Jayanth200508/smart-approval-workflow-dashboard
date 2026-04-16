import { useEffect, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { getProfileImage, setProfileImage } from "../utils/profileImageStorage";

const ProfilePage = () => {
  const { user, loginActivity } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [approvalDigestEnabled, setApprovalDigestEnabled] = useState(true);
  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: "",
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [profileImage, setProfileImageState] = useState(
    getProfileImage(user?.id),
  );
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 8;
  const activityList = loginActivity || [];
  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityList.length / ACTIVITY_PAGE_SIZE),
  );
  const activityRows = activityList.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE,
  );
  useEffect(() => {
    if (activityPage > activityTotalPages) setActivityPage(activityTotalPages);
  }, [activityPage, activityTotalPages]);

  const handleSaveProfile = (event) => {
    event.preventDefault();
    setSavedMessage(
      `Profile preferences saved at ${new Date().toLocaleTimeString()}`,
    );
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || "");
      setProfileImage(user?.id, imageData);
      setProfileImageState(imageData);
      setSavedMessage("Profile picture updated.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="profile-head">
          <span className="avatar avatar-lg">
            {profileImage ? (
              <img
                src={profileImage}
                alt={`${user?.fullName || "User"} profile`}
                className="avatar-image"
              />
            ) : (
              (user?.fullName || "U").slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <h3>Profile Details</h3>
            <p>{user?.email}</p>
          </div>
        </div>
        <form className="settings-form" onSubmit={handleSaveProfile}>
          <label>
            <span>Full Name</span>
            <input
              value={profile.fullName}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Email Address</span>
            <input
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Phone Number</span>
            <input
              value={profile.phone}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="Optional"
            />
          </label>
          <label>
            <span>Role</span>
            <input value={user?.role || ""} disabled />
          </label>
          <label>
            <span>Department</span>
            <input value={user?.department || ""} disabled />
          </label>
          <label>
            <span>Profile Picture</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleProfileImageUpload}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Save Profile
          </button>
        </form>
        {savedMessage ? <p className="muted-line">{savedMessage}</p> : null}
      </article>

      <article className="surface-card fade-in">
        <h3>Preferences</h3>
        <div className="notification-list">
          <div className="notification-item">
            <div>
              <strong>Email Notifications</strong>
              <p>Receive decision updates and reminders by email.</p>
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
              <strong>Approval Digest</strong>
              <p>Daily summary of pending approvals across your queues.</p>
            </div>
            <button
              type="button"
              className={`preference-toggle ${approvalDigestEnabled ? "on" : "off"}`}
              aria-pressed={approvalDigestEnabled}
              onClick={() => setApprovalDigestEnabled((prev) => !prev)}
            >
              {approvalDigestEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="notification-item">
            <div>
              <strong>Theme</strong>
              <p>
                Use {isDark ? "dark" : "light"} mode across the application.
              </p>
            </div>
            <button
              type="button"
              className={`preference-toggle ${isDark ? "on" : "off"}`}
              aria-pressed={isDark}
              onClick={toggleTheme}
            >
              {isDark ? "Switch to Light" : "Switch to Dark"}
            </button>
          </div>
        </div>
      </article>

      <article className="surface-card fade-in">
        <h3>Change Password</h3>
        <div className="settings-form">
          <label>
            <span>Current Password</span>
            <input type="password" placeholder="Current password" />
          </label>
          <label>
            <span>New Password</span>
            <input type="password" placeholder="New password" />
          </label>
          <label>
            <span>Confirm Password</span>
            <input type="password" placeholder="Confirm password" />
          </label>
          <button type="button" className="btn btn-primary">
            Save Password
          </button>
        </div>
      </article>

      <article className="surface-card fade-in">
        <h3>Login Activity</h3>
        <div className="notification-list">
          {activityList.length ? (
            activityRows.map((entry) => (
              <div key={entry.id} className="notification-item">
                <div>
                  <strong>{new Date(entry.timestamp).toLocaleString()}</strong>
                  <p>
                    IP: {entry.ip || "N/A"} |{" "}
                    {entry.userAgent || "Unknown device"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="muted-line">No login activity available yet.</p>
          )}
        </div>
        <PaginationControls
          page={activityPage}
          totalPages={activityTotalPages}
          onPageChange={setActivityPage}
        />
      </article>
    </section>
  );
};

export default ProfilePage;
