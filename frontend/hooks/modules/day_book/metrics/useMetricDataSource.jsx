import { useState, useEffect, useCallback, useMemo } from "react";
import useDataSource from "../data-sources/useDataSource";
import { apiGet } from "../../../../utils/api/apiClient";
import endpoints from "../../../../utils/api/endpoints";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";


export default function useMetricDataSource(){
    const { getConnectedDataSources } = useDataSource();

    const [dataSourceMappings, setDataSourceMappings] = useState([]);
    const [loadingMappings, setLoadingMappings] = useState(true);

    const [dataSourceId, setDataSourceId] = useState(null);
    const [dataSourceData, setDataSourceData] = useState([]);
    const [dataSourceVariableNames, setDataSourceVariableNames] = useState([]);
    const [downloadStatus, setDownloadStatus] = useState("unstarted"); // "unstarted" | "downloading" | "downloaded"

    // load list of data sources on mount
    useEffect(() => {
        (async () => {
            try {
                const sources = await getConnectedDataSources();
                setDataSourceMappings(
                    (sources ?? []).map((ds) => ({
                        id: ds.dataSourceId ?? ds.id,
                        name: ds.name,
                    }))
                );
            } catch (err) {
                console.error("[useMetricDataSource] Error loading data sources: ", err);
            } finally {
                setLoadingMappings(false);
            }
        })();
    }, [getConnectedDataSources]);

    // select a data source and download its data via the view-data API
    const selectDataSource = useCallback(
        async (sourceId) => {
            setDataSourceId(sourceId);
            setDownloadStatus("downloading");
            try {
                const workspaceId = await getWorkspaceId();
                const url = endpoints.modules.day_book.data_sources.viewData(sourceId);
                const response = await apiGet(url, { workspaceId });
                const raw = response?.data ?? response;

                setDataSourceData(Array.isArray(raw) ? raw : raw?.data ?? []);

                // derive variable names from schema or first row keys
                const dataArray = Array.isArray(raw) ? raw : raw?.data ?? [];
                const names = raw?.schema?.map((v) => v.name) ?? 
                    (dataArray.length > 0 ? Object.keys(dataArray[0]) : []);
                setDataSourceVariableNames(names);

                setDownloadStatus("downloaded");
            } catch (err) {
                console.error("[useMetricDataSource] Error downloading data: ", err);
                setDownloadStatus("unstarted");
            }
        }, []
    ); 

    // dropdown options
    const dropdownItems = useMemo(
        () => loadingMappings ? [{ value: null, label: "Loading..." }]
        : dataSourceMappings.map((ds) => ({ value: ds.id, label: ds.name })),
        [loadingMappings, dataSourceMappings]
    );

    return {
        dataSourceId,
        dataSourceData,
        dataSourceVariableNames,
        downloadStatus,
        loadingMappings,
        dropdownItems,
        selectDataSource,
    }

}