const STATUS_CONFIG = {
	active: {
		label: "Active",
		icon: "check-circle",
		colorKey: "primaryContainer",
		textColorKey: "onPrimaryContainer",
	},
	connected: {
		label: "Active",
		icon: "check-circle",
		colorKey: "primaryContainer",
		textColorKey: "onPrimaryContainer",
	},
	pending_upload: {
		label: "Pending",
		icon: "clock-outline",
		colorKey: "secondaryContainer",
		textColorKey: "onSecondaryContainer",
	},
	pending: {
		label: "Pending",
		icon: "clock-outline",
		colorKey: "secondaryContainer",
		textColorKey: "onSecondaryContainer",
	},
	processing: {
		label: "Processing",
		icon: "progress-clock",
		colorKey: "secondaryContainer",
		textColorKey: "onSecondaryContainer",
	},
	no_data: {
		label: "No data",
		icon: "database-off-outline",
		colorKey: "surfaceVariant",
		textColorKey: "onSurfaceVariant",
	},
	error: {
		label: "Error",
		icon: "alert-circle",
		colorKey: "errorContainer",
		textColorKey: "onErrorContainer",
	},
	failed: {
		label: "Error",
		icon: "alert-circle",
		colorKey: "errorContainer",
		textColorKey: "onErrorContainer",
	},
};

const DEFAULT_STATUS_CONFIG = {
	icon: "help-circle-outline",
	colorKey: "surfaceVariant",
	textColorKey: "onSurfaceVariant",
};

export { STATUS_CONFIG, DEFAULT_STATUS_CONFIG };
