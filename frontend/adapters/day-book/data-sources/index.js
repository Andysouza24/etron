// Public barrel for the day-book data source adapters
// Consumers should prefer this entry point so adapter file paths stay an internal detail

export {
  delay,
  validateSourceId,
  formatDate,
  createBaseAdapter,
} from "./baseAdapter";

export { createGoogleSheetsAdapter } from "./googleSheetsAdapter";
export { createExcelAdapter } from "./excelAdapter";
export { createCustomApiAdapter } from "./apiAdapter";
export { createCustomFtpAdapter } from "./ftpAdapter";
export { createMySqlAdapter } from "./mySqlAdapter";
export { createMicromaxDashboardAdapter } from "./micromaxDashboardAdapter";
export { createMicromaxDashboardFileAdapter } from "./micromaxDashboardFileAdapter";
export { createTestConnectionAdapter } from "./testConnectionAdapter";
export { createTestConnectionFileAdapter } from "./testConnectionFileAdapter";

export {
  createDataAdapter,
  getSupportedTypes,
  isTypeSupported,
  getAdapterInfo,
  getCategoryDisplayName,
  getAdaptersForUI,
} from "./DataAdapterFactory";
