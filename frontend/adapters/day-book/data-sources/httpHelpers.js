// HTTP helpers shared by API-style adapters. Keeps protocol-level concerns
// (auth headers, URL composition, error formatting) out of the adapter
// orchestration code.

export const parseHeaders = (headersString) => {
  if (!headersString?.trim()) return {};
  try {
    return JSON.parse(headersString);
  } catch (error) {
    console.warn("Failed to parse headers:", error);
    return {};
  }
};

export const parseAuthentication = (authString) => {
  if (!authString?.trim()) return null;
  try {
    return JSON.parse(authString);
  } catch (error) {
    console.warn("Failed to parse authentication:", error);
    return null;
  }
};

// Encode basic auth credentials safely across environments (web/RN/node).
export const encodeBase64 = (str) => {
  try {
    if (typeof btoa === "function") return btoa(str);
  } catch {}
  try {
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== "undefined")
      return Buffer.from(str, "utf-8").toString("base64");
  } catch {}
  console.warn(
    "Base64 encoding fallback in use; credentials may not be encoded correctly."
  );
  return str;
};

// Apply legacy `{ type, ... }` auth descriptors onto an axios-like config.
export const applyAuthentication = (config, auth) => {
  if (!auth) return config;

  switch (auth.type) {
    case "bearer":
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${auth.token}`,
      };
      break;
    case "basic": {
      const credentials = encodeBase64(`${auth.username}:${auth.password}`);
      config.headers = {
        ...config.headers,
        Authorization: `Basic ${credentials}`,
      };
      break;
    }
    case "apikey":
      config.headers = {
        ...config.headers,
        [auth.key]: auth.value,
      };
      break;
    case "query":
      if (!config.params) config.params = {};
      config.params[auth.key] = auth.value;
      break;
    default:
      console.warn("Unknown authentication type:", auth.type);
  }

  return config;
};

// Build headers from the new-style `{ authType, secrets }` connection shape.
export const buildAuthHeaders = (authType, secrets) => {
  const headers = {};
  if (!authType || !secrets) return headers;

  const kind = String(authType).toLowerCase();
  if (kind === "apikey" && secrets.apiKey) {
    headers["x-api-key"] = String(secrets.apiKey);
  } else if (kind === "bearer" && secrets.token) {
    headers.Authorization = `Bearer ${secrets.token}`;
  } else if (kind === "basic" && (secrets.username || secrets.password)) {
    const credentials = encodeBase64(
      `${secrets.username || ""}:${secrets.password || ""}`
    );
    headers.Authorization = `Basic ${credentials}`;
  }
  return headers;
};

// Compose `baseUrl + endpoint` while preserving base paths and merging query
// params. Avoids the trap of `new URL("/foo", base)` which resets the path.
export const buildApiUrl = (baseUrl, endpoint, params = {}) => {
  const [basePath, baseQuery] = String(baseUrl).split("?");
  const trimmedBase = basePath.replace(/\/+$/, "");
  const ep =
    endpoint && endpoint !== "/" ? String(endpoint).replace(/^\/+/, "") : "";
  const urlWithoutQuery = ep ? `${trimmedBase}/${ep}` : trimmedBase;

  const search = new URLSearchParams(baseQuery || "");
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `${urlWithoutQuery}?${qs}` : urlWithoutQuery;
};

// Produce a concise, actionable error message for failed HTTP calls.
export const summarizeRequestError = (error, reqUrl) => {
  const status =
    error?.response?.status ?? error?.statusCode ?? error?.status ?? null;
  const headers = error?.response?.headers || {};
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  const data = error?.response?.data;
  const body =
    typeof data === "string"
      ? data
      : data
      ? (() => {
          try {
            return JSON.stringify(data);
          } catch {
            return String(data);
          }
        })()
      : "";
  const isHtml =
    /text\/html/i.test(contentType) || /<!DOCTYPE html>/i.test(body || "");
  const ngrokOffline = /ERR_NGROK_3200|endpoint .* is offline/i.test(
    body || ""
  );
  let hint = "";
  if (isHtml && ngrokOffline) hint = "ngrok endpoint appears offline";
  else if (isHtml) hint = "server returned an HTML error page";

  const preview = isHtml
    ? hint
    : (body || "").replace(/\s+/g, " ").slice(0, 200).trim();

  const statusPart = status ? `Server error ${status}` : "Request failed";
  const urlPart = reqUrl ? ` (${reqUrl})` : "";
  return [statusPart, preview ? `- ${preview}` : "", urlPart].join(" ").trim();
};

// Dispatch an HTTP method via the apiClient. Returns a normalized response.
export const dispatchHttp = async (apiClient, method, url, data, config) => {
  const upper = String(method).toUpperCase();
  const isGet = upper === "GET";
  const isDelete = upper === "DELETE";
  const fn = apiClient?.[upper.toLowerCase()];

  if (typeof fn !== "function") {
    throw new Error(`HTTP method not supported by apiClient: ${upper}`);
  }

  const start = Date.now();
  const res =
    isGet || isDelete
      ? await fn.call(apiClient, url, config)
      : await fn.call(apiClient, url, data, config);
  const durationMs = Date.now() - start;
  return {
    data: res?.data,
    statusCode: res?.status,
    headers: res?.headers,
    responseTime: `${durationMs}ms`,
  };
};
