// Registry mapping data-source types to their legacy ConnectionPage-based screens.
// Lives in the adapters folder alongside the per-adapter screen files.
// Kept separate from `DataAdapterFactory.js` so the factory module stays free
// of UI/component imports (and the require cycle that comes with them).

import ApiConnectionScreen from "./api/ApiConnectionScreen";
import ExcelConnectionScreen from "./excel/ExcelConnectionScreen";
import FtpConnectionScreen from "./ftp/FtpConnectionScreen";
import GoogleSheetsConnectionScreen from "./google-sheets/GoogleSheetsConnectionScreen";
import MicromaxDashboardConnectionScreen from "./micromax/MicromaxDashboardConnectionScreen";
import MySqlConnectionScreen from "./mysql/MySqlConnectionScreen";

const screenByType = {
  api: ApiConnectionScreen,
  "custom-api": ApiConnectionScreen,
  "custom-ftp": FtpConnectionScreen,
  "google-sheets": GoogleSheetsConnectionScreen,
  "micromax-dashboard": MicromaxDashboardConnectionScreen,
  "microsoft-excel": ExcelConnectionScreen,
  mysql: MySqlConnectionScreen,
};

export function getConnectionScreen(type) {
  return screenByType[type] || null;
}
