import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getProfileImage, setProfileImage } from "../utils/profileImageStorage";

const AdminProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    department: user?.department || "Executive",
    contact: "",
  });
  const [saved, setSaved] = useState("");
  const [profileImage, setProfileImageState] = useState(
    getProfileImage(user?.id),
  );

  const handleSave = (event) => {
    event.preventDefault();
    setSaved(`Profile updated at ${new Date().toLocaleTimeString()}`);
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || "");
      setProfileImage(user?.id, imageData);
      setProfileImageState(imageData);
      setSaved("Profile picture updated.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Admin Profile</h3>
        <div className="profile-head">
          <span className="avatar avatar-lg">
            {profileImage ? (
              <img
                src={profileImage}
                alt={`${user?.fullName || "Admin"} profile`}
                className="avatar-image"
              />
            ) : (
              (user?.fullName || "A").slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <p>{user?.email}</p>
          </div>
        </div>
        <p className="muted-line">
          Manage your account details and security settings.
        </p>
        <form className="settings-form" onSubmit={handleSave}>
          <label>
            <span>Name</span>
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
            <span>Email</span>
            <input
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Department</span>
            <input
              value={profile.department}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  department: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Contact Information</span>
            <input
              value={profile.contact}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, contact: event.target.value }))
              }
              placeholder="Phone or alternate contact"
            />
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
        {saved ? <p className="muted-line">{saved}</p> : null}
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
            Update Password
          </button>
        </div>
      </article>
    </section>
  );
};

export default AdminProfilePage;
