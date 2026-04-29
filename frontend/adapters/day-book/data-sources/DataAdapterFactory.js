// aggregates adapter descriptors and derives lookup maps and UI catelog from them

import { adapterDescriptor as apiDescriptor } from "./apiAdapter";
import { adapterDescriptor as excelDescriptor } from "./excelAdapter";
import { adapterDescriptor as ftpDescriptor } from "./ftpAdapter";
import { adapterDescriptor as googleSheetsDescriptor } from "./googleSheetsAdapter";
import { adapterDescriptor as mySqlDescriptor } from "./mySqlAdapter";
import { adapterDescriptor as micromaxDashboardDescriptor } from "./micromaxDashboardAdapter";
import { adapterDescriptor as micromaxDashboardFileDescriptor } from "./micromaxDashboardFileAdapter";
import { adapterDescriptor as localCsvDescriptor } from "./localCsvAdapter";

const DESCRIPTORS = [
  googleSheetsDescriptor,
  excelDescriptor,
  apiDescriptor,
  ftpDescriptor,
  mySqlDescriptor,
  micromaxDashboardDescriptor,
  micromaxDashboardFileDescriptor,
  localCsvDescriptor,
];

// Build derived registries once at module load.
const factoryByType = {};
const screenByType = {};
const categoryByType = {};
const wizardByType = {};

DESCRIPTORS.forEach((descriptor) => {
  const keys = [descriptor.type, ...(descriptor.aliases || [])];
  keys.forEach((key) => {
    factoryByType[key] = descriptor.factory;
    if (descriptor.ConnectionScreen) {
      screenByType[key] = descriptor.ConnectionScreen;
    }
    if (descriptor.wizard) {
      wizardByType[key] = descriptor.wizard;
    }
    categoryByType[key] = descriptor.category;
  });
});

const CATEGORY_LABELS = {
  "local-files": "Local Files",
  "cloud-storage": "Spreadsheets",
  api: "APIs",
  database: "Databases",
  "file-transfer": "File Transfer",
  "micromax-dashboard": "Micromax Dashboard",
};

export function getCategoryDisplayName(category) {
  return CATEGORY_LABELS[category] || "Other";
}

export function createDataAdapter(type, dependencies) {
  const factory = factoryByType[type];
  if (!factory) throw new Error(`No adapter for type: ${type}`);
  return factory(
    dependencies.authService,
    dependencies.apiClient,
    dependencies.options || {}
  );
}

export function getSupportedTypes() {
  return Object.keys(factoryByType);
}

export function isTypeSupported(type) {
  return Object.prototype.hasOwnProperty.call(factoryByType, type);
}

export function getConnectionScreen(type) {
  return screenByType[type] || null;
}
// returns wizard config for given source type
// returns null if type not migrated to wizard yet
// wizard config shape:
/*
{
  steps: [{ key, title, Component, props?, applies?(draft) }],
  finalise: async (draft, context) => result,  // optional, runs on the final step's primary action
  initialDraft: object, // optional starting state
}
*/
export function getWizardConfig(type) {
  return wizardByType[type] || null;
}

export function getAdapterInfo(type) {
  const category = categoryByType[type] || "other";
  return {
    type,
    category,
    categoryDisplayName: getCategoryDisplayName(category),
  };
}

// UI catalog shown on the "create connection" picker
// it intentionally includes flows that have no runtime adapter
// groups adapters by user-facing category
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
            "/modules/day-book/data-management/data-connection-inputs/custom-api",
        },
      ],
    },
  ];
}
