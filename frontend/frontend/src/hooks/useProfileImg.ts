import { useEffect, useState } from "react";
import { getMediaUrl } from "../utils/chatHelpers";
import { PROFILE_IMG_STORAGE_KEY } from "../utils/profileStorage";

export function useProfileImgPath() {
  const [path, setPath] = useState(
    () => localStorage.getItem(PROFILE_IMG_STORAGE_KEY) || "",
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_IMG_STORAGE_KEY) {
        setPath(event.newValue || "");
      }
    };
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setPath(detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("profile-img-updated", onUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("profile-img-updated", onUpdated);
    };
  }, []);

  return path;
}

export function useProfileImgUrl() {
  return getMediaUrl(useProfileImgPath());
}
