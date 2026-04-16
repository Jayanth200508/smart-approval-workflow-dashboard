const PROFILE_IMAGES_KEY = "flowpilot_profile_images_v1";
export const PROFILE_IMAGE_UPDATED_EVENT = "flowpilot:profile-image-updated";

const readStore = () => {
  try {
    const raw = localStorage.getItem(PROFILE_IMAGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (value) => {
  localStorage.setItem(PROFILE_IMAGES_KEY, JSON.stringify(value));
};

export const getProfileImage = (userId) => {
  if (!userId) return "";
  const store = readStore();
  return store[userId] || "";
};

export const setProfileImage = (userId, imageDataUrl) => {
  if (!userId) return;
  const store = readStore();
  store[userId] = imageDataUrl || "";
  writeStore(store);
  window.dispatchEvent(
    new CustomEvent(PROFILE_IMAGE_UPDATED_EVENT, { detail: { userId } }),
  );
};
