/**
 * Razčleni neuspešen fetch Response (JSON).
 * Podpira novo obliko { success: false, error: { code, message } } in stare { error }, { message }.
 *
 * @param {Response} res
 * @returns {Promise<{ message: string, code: string, raw?: unknown }>}
 */
export async function parseApiErrorResponse(res) {
  let data = null;
  try {
    data = await res.clone().json();
  } catch {
    return {
      code: "HTTP_ERROR",
      message: res.statusText || "Napaka pri zahtevi.",
    };
  }

  if (data && data.success === false && data.error && typeof data.error.message === "string") {
    return {
      code: String(data.error.code || "ERROR"),
      message: data.error.message,
      raw: data,
    };
  }
  if (
    data &&
    data.error &&
    typeof data.error === "object" &&
    typeof data.error.message === "string"
  ) {
    return {
      code: String(data.error.code || "ERROR"),
      message: data.error.message,
      raw: data,
    };
  }
  if (data && typeof data.error === "string") {
    return { code: "ERROR", message: data.error, raw: data };
  }
  if (data && typeof data.message === "string") {
    return { code: "ERROR", message: data.message, raw: data };
  }
  return {
    code: "UNKNOWN",
    message: "Napaka pri zahtevi.",
    raw: data,
  };
}

/** Isto kot `parseApiErrorResponse` (krajše ime za uvoz). */
export const parseApiError = parseApiErrorResponse;

/**
 * Besedilo napake iz že razčlenjenega JSON telesa (npr. po `await res.json()`).
 * Uporabi, ko telo odgovora ne moreš več brati prek `parseApiErrorResponse(res)`.
 *
 * @param {unknown} data
 * @returns {string}
 */
export function getApiErrorMessageFromBody(data) {
  if (!data || typeof data !== "object") return "";
  if (data.success === false && data.error && typeof data.error.message === "string") {
    return data.error.message;
  }
  if (data.error && typeof data.error === "object" && typeof data.error.message === "string") {
    return data.error.message;
  }
  if (typeof data.error === "string") return data.error;
  if (typeof data.message === "string") return data.message;
  return "";
}
