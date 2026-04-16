export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// Keep backend integration optional; mock services take over when explicitly disabled.
export const ENABLE_BACKEND = import.meta.env.VITE_ENABLE_BACKEND === "true";

export const isNetworkError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed")
  );
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getAuthToken = () => {
  try {
    const raw = localStorage.getItem("smart_approval_auth");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.token || "";
  } catch {
    return "";
  }
};

export const callApi = async (path, options = {}) => {
  if (!ENABLE_BACKEND) {
    throw new Error("Backend disabled");
  }

  const requestOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, requestOptions);
  } catch (networkError) {
    // Retry once for transient startup/network hiccups.
    await new Promise((resolve) => setTimeout(resolve, 350));
    response = await fetch(`${API_URL}${path}`, requestOptions);
  }

  const body = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(body?.message || "Request failed");
  }
  // Backend wraps successful payloads as { success: true, data: ... }.
  // Unwrap here so all service callers receive the actual data shape.
  if (
    body &&
    typeof body === "object" &&
    Object.prototype.hasOwnProperty.call(body, "data")
  ) {
    return body.data;
  }
  return body;
};
