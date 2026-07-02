export const PROFILE_IMG_STORAGE_KEY = "profile_img";

/** Keep sidebar/dashboard avatars in sync after profile photo changes. */
export function persistProfileImg(path?: string | null) {
  const value = path?.trim();
  if (!value) return;
  localStorage.setItem(PROFILE_IMG_STORAGE_KEY, value);
  window.dispatchEvent(
    new CustomEvent("profile-img-updated", { detail: value }),
  );
}

export function mergeProfileImg<T extends { profile_img?: string }>(
  next: T,
  previous?: { profile_img?: string } | null,
): T {
  const profile_img = next.profile_img?.trim()
    ? next.profile_img
    : previous?.profile_img || "";
  return { ...next, profile_img };
}
