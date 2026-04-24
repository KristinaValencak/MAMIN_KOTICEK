/** Čas brez prijave na segment (prvi in drugi krog); UX; API ostane avtoritativni. */
export const GUEST_BROWSE_LIMIT_MS = 10 * 60_000;

export const GUEST_SESSION_STORAGE_KEY = "mk_guest_browse_started";
/** "1" = prvi mehki opomin je bil zaprt (križec); teče drugi segment, nato trd modal. */
export const GUEST_SNOOZE_USED_KEY = "mk_guest_snooze_used";

/** Vrednost `reason` na modalu: prvi mehak opomin (zapirljiv; križec začne drugi segment). */
export const GUEST_TIMER_REASON_GRACE = "timer_grace";
