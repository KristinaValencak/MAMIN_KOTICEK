/** Zamik pred začetkom prednalaganja GET /api/posts/:id ob hoverju nad kartico (ms). */
export const POST_DETAIL_HOVER_PREFETCH_MS = 120;

/** Prva stran komentarjev — manjši JSON kot prejšnjih 15; „Naloži več“ po potrebi. */
export const COMMENTS_FIRST_PAGE_LIMIT = 10;

/** Po omogočitvi fetcha komentarjev ob predogledu z lista: kratek zamik za prednost objave/slike (ms). */
export const COMMENTS_PREVIEW_DEFER_MS = 280;
