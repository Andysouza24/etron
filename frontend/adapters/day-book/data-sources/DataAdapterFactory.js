// Minimal implementation for UI: provide at least one example adapter/category
export function getAdaptersForUI() {
	return [
		{
			heading: "Local Files",
			category: "local-files",
			adapters: [
				{
					label: "Upload CSV",
					icon: "file",
					type: "local-csv",
					description: "Upload a local csv file",
					route:
						"/modules/day-book/data-management/data-connection-inputs/local-csv",
				},
			],
		},
		{
			heading: "Micromax Dashboard",
			category: "micromax-dashboard",
			adapters: [
				{
					label: "Micromax Dashboard",
					icon: "view-dashboard-outline",
					type: "micromax-dashboard",
					description:
						"Connect to the Micromax Dashboard data feed. Every file in the export bucket becomes its own data source.",
					iconColor: "#0F62FE",
					route:
						"/modules/day-book/data-management/data-connection-inputs/micromax-dashboard",
				},
			],
		},
		/*{
			heading: "Spreadsheets",
			category: "cloud-storage",
			adapters: [
				{
					label: "Google Sheets",
					icon: "google-spreadsheet",
					type: "google-sheets",
					description: "Connect to Google Sheets via Google Drive API",
					iconColor: "#0F9D58",
					route:
						"/modules/day-book/data-management/data-connection-inputs/google",
				},
				{
					label: "Microsoft Excel",
					icon: "microsoft-excel",
					type: "microsoft-excel",
					description: "Connect to Excel files via Microsoft Graph API",
					iconColor: "#1D6F42",
					route:
						"/modules/day-book/data-management/data-connection-inputs/excel",
				},
			],
		},*/
		{
			heading: "APIs",
			category: "api",
			adapters: [
				{
					label: "Custom API",
					icon: "web",
					type: "api",
					description: "Connect to a custom REST API endpoint",
					route:
						"/modules/day-book/data-management/data-connection-inputs/custom-API",
				},
				/*{
					label: "Custom FTP",
					icon: "server",
					type: "custom-ftp",
					description: "Connect to FTP/SFTP servers for file access",
					route:
						"/modules/day-book/data-management/data-connection-inputs/custom-FTP",
				},*/
			],
		},
		/*{
			heading: "Databases",
			category: "database",
			adapters: [
				{
					label: "MySQL",
					icon: "database",
					type: "mysql",
					description: "Connect to MySQL databases",
					route:
						"/modules/day-book/data-management/data-connection-inputs/MySQL",
				},
			],
		},*/
	];
}
import { createGoogleSheetsAdapter } from "./googleSheetsAdapter";
import { createExcelAdapter } from "./excelAdapter";
import { createCustomApiAdapter } from "./apiAdapter";
import { createCustomFtpAdapter } from "./ftpAdapter";
import { createMySqlAdapter } from "./mySqlAdapter";
import { createMicromaxDashboardAdapter } from "./micromaxDashboardAdapter";
import { createMicromaxDashboardFileAdapter } from "./micromaxDashboardFileAdapter";

// TODO: figure out whats going on with this
const adapterMap = {
	"google-sheets": createGoogleSheetsAdapter,
	"microsoft-excel": createExcelAdapter,
	// Support backend 'api' type by mapping to the custom API adapter
	api: createCustomApiAdapter,
	"custom-api": createCustomApiAdapter,
	"custom-ftp": createCustomFtpAdapter,
	mysql: createMySqlAdapter,
	"micromax-dashboard": createMicromaxDashboardAdapter,
	"micromax-dashboard-file": createMicromaxDashboardFileAdapter,
};

export function createDataAdapter(type, dependencies) {
	const factory = adapterMap[type];
	if (!factory) throw new Error(`No adapter for type: ${type}`);
	return factory(
		dependencies.authService,
		dependencies.apiClient,
		dependencies.options || {}
	);
}

export function getSupportedTypes() {
	return Object.keys(adapterMap);
}

// TODO: fix categories
const typeToCategory = {
	// Spreadsheets / cloud storage
	"google-sheets": "cloud-storage",
	"microsoft-excel": "cloud-storage",
	// APIs
	api: "api",
	"custom-api": "api",
	// File transfer
	"custom-ftp": "file-transfer",
	// Databases
	mysql: "database",
	// Micromax Dashboard parent + auto-managed file children
	"micromax-dashboard": "micromax-dashboard",
	"micromax-dashboard-file": "micromax-dashboard",
};

export function getCategoryDisplayName(category) {
	switch (category) {
		case "local-files":
			return "Local Files";
		case "cloud-storage":
			return "Spreadsheets";
		case "api":
			return "APIs";
		case "database":
			return "Databases";
		case "file-transfer":
			return "File Transfer";
		case "micromax-dashboard":
			return "Micromax Dashboard";
		default:
			return "Other";
	}
}

export function getAdapterInfo(type) {
	const category = typeToCategory[type] || "other";
	return {
		type,
		category,
		categoryDisplayName: getCategoryDisplayName(category),
	};
}
