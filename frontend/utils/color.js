const HEX_COLOR_REGEX = /^#([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i;

export function sanitizeHexColor(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const upper = prefixed.toUpperCase();
  if (!HEX_COLOR_REGEX.test(upper)) {
    return "";
  }

  const shortMatch = upper.match(/^#([0-9A-F]{3})$/i);
  if (shortMatch) {
    const [, short] = shortMatch;
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }

  return upper;
}

export function isValidHexColor(value) {
  if (typeof value !== "string") return false;
  const candidate = value.trim().toUpperCase();
  if (!candidate) return false;
  return HEX_COLOR_REGEX.test(candidate);
}

export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== "string") return "rgba(0,0,0,0)";
  const trimmed = hex.trim();
  if (trimmed.startsWith("rgba")) {
    if (typeof alpha === "number") {
      return trimmed.replace(
        /rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
        (_, r, g, b) => `rgba(${r},${g},${b},${alpha})`
      );
    }
    return trimmed;
  }
  if (trimmed.startsWith("rgb(")) {
    if (typeof alpha === "number") {
      const match = trimmed.match(/rgb\(([^,]+),([^,]+),([^\)]+)\)/);
      if (match) {
        const [, r, g, b] = match;
        return `rgba(${r.trim()},${g.trim()},${b.trim()},${alpha})`;
      }
    }
    return trimmed.replace("rgb(", "rgba(").replace(/\)$/, ",1)");
  }
  if (!trimmed.startsWith("#")) return trimmed;

  let hexBody = trimmed.slice(1);
  if (hexBody.length === 3 || hexBody.length === 4) {
    hexBody = hexBody
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hexBody.length === 6 || hexBody.length === 8) {
    const hasAlpha = hexBody.length === 8;
    const bigint = parseInt(hexBody, 16);
    const r = (bigint >> (hasAlpha ? 24 : 16)) & 255;
    const g = (bigint >> (hasAlpha ? 16 : 8)) & 255;
    const b = (bigint >> (hasAlpha ? 8 : 0)) & 255;
    let a = hasAlpha ? (bigint & 255) / 255 : 1;
    if (typeof alpha === "number") a = alpha;
    return `rgba(${r},${g},${b},${a})`;
  }
  return "rgba(0,0,0,0)";
}

export function withAlpha(color, alpha) {
  return hexToRgba(color, alpha);
}
