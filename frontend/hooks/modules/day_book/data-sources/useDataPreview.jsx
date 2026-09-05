// Author(s): Holly Wyatt, Noah Bradley

import { useState, useCallback } from "react";

import endpoints from "../../../../utils/api/endpoints";
import { apiGet } from "../../../../utils/api/apiClient";

export default function useDataPreview(workspaceId) {
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewStatus, setPreviewStatus] = useState("idle");
	const [previewSchema, setPreviewSchema] = useState([]);
	const [previewRows, setPreviewRows] = useState([]);

	const openPreview = useCallback(async (source) => {
		try {
			setPreviewOpen(true);
			setPreviewStatus("loading");
			const res = await apiGet(
				endpoints.modules.day_book.data_sources.viewData(source.dataSourceId),
				{ workspaceId }
			);
			const { data = [], schema = [] } = res.data || {};
			setPreviewRows(Array.isArray(data) ? data : []);
			setPreviewSchema(Array.isArray(schema) ? schema : []);
			setPreviewStatus("ready");
		} catch (err) {
			console.error("[useDataPreview] openPreview:", err);
			setPreviewStatus("error");
		}
	}, [workspaceId]);

	const dismissPreview = useCallback(() => {
		setPreviewOpen(false);
		setPreviewStatus("idle");
		setPreviewSchema([]);
		setPreviewRows([]);
	}, []);

	return {
		previewOpen,
		previewStatus,
		previewSchema,
		previewRows,
		openPreview,
		dismissPreview,
	};
}
