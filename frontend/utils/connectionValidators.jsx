// Validation, name-generation, and payload builders for connection forms.
// Each data-source type (API, FTP, MySQL, dashboard) gets a validate + build pair.
// TODO: move data-source-specific validation rules into the adapters.

const validateUrl = (url) => {
  if (!url?.trim()) return "API URL is required";
  
  try {
    new URL(url);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return "URL must start with http:// or https://";
    }
    return null;
  } catch {
    return "Please enter a valid URL";
  }
};

const validateHeaders = (headers) => {
  if (!headers?.trim()) return null;
  
  try {
    JSON.parse(headers);
    return null;
  } catch {
    return "Headers must be valid JSON format";
  }
};

const validateHostname = (hostname) => {
  if (!hostname?.trim()) return "Hostname is required";

  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!hostnameRegex.test(hostname.trim())) {
    return "Please enter a valid hostname";
  }
  
  return null;
};

const validatePort = (port) => {
  if (!port?.trim()) return null;
  
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return "Port must be a number between 1 and 65535";
  }
  
  return null;
};

const validateRequired = (value, fieldName) => {
  if (!value?.trim()) return `${fieldName} is required`;
  return null;
};

// api validation
export const validateApiForm = (formData, returnErrors = false) => {
  const errors = {};
  // name optional, generated from url if left blank
  const urlError = validateUrl(formData.url);
  if (urlError) errors.url = urlError;
  
  const headersError = validateHeaders(formData.headers);
  if (headersError) errors.headers = headersError;
  
  if (returnErrors) {
    return Object.keys(errors).length === 0 ? true : errors;
  }
  
  return Object.keys(errors).length === 0;
};

// ftp validation
export const validateFtpForm = (formData, returnErrors = false) => {
  const errors = {};
  
  const nameError = validateRequired(formData.name, "Connection name");
  if (nameError) errors.name = nameError;
  
  const hostnameError = validateHostname(formData.hostname);
  if (hostnameError) errors.hostname = hostnameError;
  
  const portError = validatePort(formData.port);
  if (portError) errors.port = portError;
  
  const usernameError = validateRequired(formData.username, "Username");
  if (usernameError) errors.username = usernameError;

  if (!formData.password?.trim() && !formData.keyFile?.trim()) {
    errors.password = "Password is required (unless using key file)";
  }
  
  if (returnErrors) {
    return Object.keys(errors).length === 0 ? true : errors;
  }
  
  return Object.keys(errors).length === 0;
};

export const validateMySqlForm = (formData, returnErrors = false) => {
  const errors = {};

  const nameError = validateRequired(formData.name, "Connection name");
  if (nameError) errors.name = nameError;

  const hostError = validateHostname(formData.host);
  if (hostError) errors.host = hostError;

  const portError = validatePort(formData.port);
  if (portError) errors.port = portError;

  const usernameError = validateRequired(formData.username, "Username");
  if (usernameError) errors.username = usernameError;

  const passwordError = validateRequired(formData.password, "Password");
  if (passwordError) errors.password = passwordError;

  const databaseError = validateRequired(formData.database, "Database");
  if (databaseError) errors.database = databaseError;

  if (returnErrors) {
    return Object.keys(errors).length === 0 ? true : errors;
  }

  return Object.keys(errors).length === 0;
};

// name generation utilities
export const generateApiNameFromUrl = (formData) => {
  const url = formData.url;
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const name = urlObj.hostname.replace('www.', '').replace(/\./g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1) + ' API';
  } catch (error) {
    console.error("Invalid url, cannot generate name:", error);
    return "";
  }
};

export const generateFtpNameFromHostname = (formData) => {
  const hostname = formData.hostname;
  if (!hostname) return "";
  
  const name = hostname.replace(/\./g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1) + ' FTP';
};

export const generateMySqlNameFromHostname = (formData) => {
  const host = formData.host;
  if (!host) return "";

  const name = host.replace(/\./g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1) + ' MySQL';
};

// connection data builders
export const buildApiConnectionData = (formData) => ({
  name: formData.name?.trim(),
  url: formData.url?.trim(),
  headers: formData.headers?.trim(),
  // New fields to support typed auth selection
  authType: formData.authType || undefined,
  // For apiKey
  apiKey: formData.authType === 'apiKey' ? formData.apiKey?.trim() : undefined,
  apiKeyHeader: formData.authType === 'apiKey' ? formData.apiKeyHeader?.trim() : undefined,
  // For bearer/jwt
  token: (formData.authType === 'bearer' || formData.authType === 'jwt') ? formData.token?.trim() : undefined,
  // For basic
  username: formData.authType === 'basic' ? formData.username?.trim() : undefined,
  password: formData.authType === 'basic' ? formData.password?.trim() : undefined,
  // Legacy freeform authentication string (optional)
  authentication: formData.authentication?.trim()
});

export const buildFtpConnectionData = (formData) => ({
  name: formData.name?.trim(),
  hostname: formData.hostname?.trim(),
  port: formData.port?.trim() || '21',
  username: formData.username?.trim(),
  password: formData.password?.trim(),
  keyFile: formData.keyFile?.trim(),
  // Keep legacy 'directory' for UI, but include 'filePath' as required by backend
  directory: formData.directory?.trim() || '/',
  filePath: (formData.filePath || formData.directory)?.trim() || '/'
});

export const buildMySqlConnectionData = (formData) => ({
  name: formData.name?.trim(),
  host: formData.host?.trim(),
  port: formData.port?.trim() || '3306',
  username: formData.username?.trim(),
  password: formData.password?.trim(),
  database: formData.database?.trim()
});

// dashboard raw data validation
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

export const validateDashboardRawDataForm = (formData, returnErrors = false) => {
  const errors = {};

  const nameError = validateRequired(formData.name, "Connection name");
  if (nameError) errors.name = nameError;

  const fileName = formData.fileName?.trim();
  if (!fileName) {
    errors.fileName = "File name is required";
  } else if (!FILE_NAME_PATTERN.test(fileName)) {
    errors.fileName = "File name must be a .json file with letters, numbers, '.', '_' or '-' only";
  }

  if (returnErrors) {
    return Object.keys(errors).length === 0 ? true : errors;
  }
  return Object.keys(errors).length === 0;
};

export const buildDashboardRawDataConnectionData = (formData) => ({
  name: formData.name?.trim(),
  fileName: formData.fileName?.trim(),
  description: formData.description?.trim() || undefined,
});


// parent connection - optional name, no config, children auto discovered
export const validateMicromaxDashboardForm = (formData, returnErrors = false) => {
  const errors = {};

  const trimmedName = formData?.name?.trim();
  if (trimmedName && trimmedName.length > 100) {
    errors.name = "Connection name must be 100 characters or fewer";
  }

  if (returnErrors) {
    return Object.keys(errors).length === 0 ? true : errors;
  }
  return Object.keys(errors).length === 0;
};

export const buildMicromaxDashboardConnectionData = (formData) => ({
  name: formData?.name?.trim() || "Micromax Dashboard",
});