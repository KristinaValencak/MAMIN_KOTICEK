import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getStoredUser } from "../utils/helpers";
import { GUEST_BROWSE_LIMIT_MS, GUEST_SESSION_STORAGE_KEY, GUEST_SNOOZE_USED_KEY, GUEST_TIMER_REASON_GRACE } from "../constants/guestLimits";
import AuthGateModal from "../components/auth/AuthGateModal";

const GUEST_TIMER_DISABLED_PATHS = new Set([
  "/o-nas",
  "/prijava",
  "/registracija",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/pogoji-uporabe",
  "/politika-zasebnosti",
  "/politika-piskotkov",
]);

const defaultCtx = {
  requestAuth: () => {},
  closeAuth: () => {},
};

const AuthGateContext = createContext(defaultCtx);

export function useAuthGate() {
  return useContext(AuthGateContext);
}

function clearGuestSessionKeys() {
  try {
    sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(GUEST_SNOOZE_USED_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthGateProvider({ children }) {
  const location = useLocation();
  const [modal, setModal] = useState({
    isOpen: false,
    tab: "login",
    reason: null,
  });
  const timerRef = useRef(null);
  const scheduleGuestTimerRef = useRef(null);

  const requestAuth = useCallback((opts = {}) => {
    setModal({
      isOpen: true,
      tab: opts.tab === "register" ? "register" : "login",
      reason: typeof opts.reason === "string" ? opts.reason : null,
    });
  }, []);

  const closeAuth = useCallback(() => {
    setModal((m) => {
      const isGrace = m.reason === GUEST_TIMER_REASON_GRACE;
      const isTimer = m.reason === "timer";
      let snoozeUsed = false;
      try {
        snoozeUsed = sessionStorage.getItem(GUEST_SNOOZE_USED_KEY) === "1";
      } catch {
        /* ignore */
      }
      if (isGrace && !snoozeUsed) {
        try {
          sessionStorage.setItem(GUEST_SNOOZE_USED_KEY, "1");
          sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        queueMicrotask(() => {
          scheduleGuestTimerRef.current?.();
        });
      } else if (isTimer) {
        // Keep the timer behavior but never hard-lock: after dismiss, start a fresh segment.
        // If the guest already used snooze, we keep it that way so we continue showing "timer" on expiry.
        try {
          sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        queueMicrotask(() => {
          scheduleGuestTimerRef.current?.();
        });
      }
      return { ...m, isOpen: false };
    });
  }, []);

  const onAuthenticatedClose = useCallback(() => {
    setModal((m) => ({ ...m, isOpen: false }));
  }, []);

  const scheduleGuestTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (getStoredUser()) return;
    if (GUEST_TIMER_DISABLED_PATHS.has(location.pathname)) return;

    let startRaw = sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!startRaw || !Number.isFinite(Number(startRaw))) {
      startRaw = String(Date.now());
      try {
        sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, startRaw);
      } catch {
        /* ignore */
      }
    }
    const startMs = Number(startRaw);
    const deadline = startMs + GUEST_BROWSE_LIMIT_MS;
    const delay = deadline - Date.now();

    const fireExpired = () => {
      let snoozeUsed = false;
      try {
        snoozeUsed = sessionStorage.getItem(GUEST_SNOOZE_USED_KEY) === "1";
      } catch {
        /* ignore */
      }
      if (snoozeUsed) {
        requestAuth({ tab: "login", reason: "timer" });
        return;
      }
      requestAuth({ tab: "login", reason: GUEST_TIMER_REASON_GRACE });
    };

    if (delay <= 0) {
      fireExpired();
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fireExpired();
    }, delay);
  }, [requestAuth, location.pathname]);

  scheduleGuestTimerRef.current = scheduleGuestTimer;

  useEffect(() => {
    const onAuthChanged = () => {
      if (getStoredUser()) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        clearGuestSessionKeys();
        return;
      }
      clearGuestSessionKeys();
      scheduleGuestTimer();
    };

    window.addEventListener("auth-changed", onAuthChanged);
    scheduleGuestTimer();
    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleGuestTimer, location.pathname]);

  const value = useMemo(
    () => ({
      requestAuth,
      closeAuth,
    }),
    [requestAuth, closeAuth]
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthGateModal
        isOpen={modal.isOpen}
        tab={modal.tab}
        reason={modal.reason}
        onClose={closeAuth}
        onAuthenticated={onAuthenticatedClose}
        onTabChange={(tab) => setModal((m) => ({ ...m, tab }))}
      />
    </AuthGateContext.Provider>
  );
}
