const LOCK_KEY = "app_lock_enabled";
const UNLOCK_KEY = "app_unlocked_session";
const CREDENTIAL_ID_KEY = "app_lock_credential_id";

/** Re-lock after this much idle time (ms). */
export const LOCK_IDLE_MS = 2 * 60 * 1000;

let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function isAppLockEnabled() {
  return localStorage.getItem(LOCK_KEY) === "1";
}

export function lockSession() {
  sessionStorage.removeItem(UNLOCK_KEY);
  window.dispatchEvent(new Event("app-lock-required"));
}

export function setAppLockEnabled(enabled: boolean) {
  localStorage.setItem(LOCK_KEY, enabled ? "1" : "0");
  if (!enabled) {
    markSessionUnlocked();
    localStorage.removeItem(CREDENTIAL_ID_KEY);
    clearAutoLockTimer();
  } else {
    lockSession();
  }
}

export function isSessionUnlocked() {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function markSessionUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
  scheduleAutoLock();
}

export function clearAutoLockTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/** Lock again after idle period while app lock is on. */
export function scheduleAutoLock() {
  clearAutoLockTimer();
  if (!isAppLockEnabled() || !isSessionUnlocked()) return;
  idleTimer = setTimeout(() => {
    lockSession();
  }, LOCK_IDLE_MS);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getRpId() {
  return window.location.hostname;
}

export async function registerBiometricCredential(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;

  const existingId = localStorage.getItem(CREDENTIAL_ID_KEY);
  if (existingId) {
    const verified = await tryBiometricUnlock();
    if (verified) {
      lockSession();
      return true;
    }
    localStorage.removeItem(CREDENTIAL_ID_KEY);
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(
      localStorage.getItem("employee_id") || "user",
    );
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Attendance System", id: getRpId() },
        user: {
          id: userId,
          name: localStorage.getItem("employee_email") || "user@local",
          displayName: localStorage.getItem("employee_name") || "User",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "preferred",
          requireResidentKey: false,
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential?.rawId) return false;

    localStorage.setItem(
      CREDENTIAL_ID_KEY,
      bufferToBase64(credential.rawId),
    );
    lockSession();
    return true;
  } catch {
    return false;
  }
}

export async function tryBiometricUnlock(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    markSessionUnlocked();
    return true;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const storedId = localStorage.getItem(CREDENTIAL_ID_KEY);
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
      rpId: getRpId(),
    };

    if (storedId) {
      publicKey.allowCredentials = [
        {
          id: base64ToBuffer(storedId),
          type: "public-key",
          transports: ["internal", "hybrid"],
        },
      ];
    }

    const assertion = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential | null;

    if (!assertion) return false;

    markSessionUnlocked();
    return true;
  } catch {
    return false;
  }
}

/** Call when user backgrounds the app — lock again on return. */
export function onAppBackgrounded() {
  if (isAppLockEnabled() && localStorage.getItem("employee_id")) {
    lockSession();
  }
}

export function shouldShowLockScreen() {
  return (
    isAppLockEnabled() &&
    Boolean(localStorage.getItem("employee_id")) &&
    !isSessionUnlocked()
  );
}
