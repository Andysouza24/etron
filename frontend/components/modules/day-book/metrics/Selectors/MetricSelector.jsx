import { useState, useEffect } from "react";
import metricService from "../../../../../services/MetricService";
import GenericSelector from "./GenericSelector";


// TODO: update show router button in drop down component to navigate to creating a new simple metric from this data source

export default function MetricSelector({ dataSourceId, onMetricSelect, selectedMetricId}){
    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState([]);

    useEffect(() => {
        if (dataSourceId) {
            fetchMetrics();
        }
    }, [dataSourceId]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const result = await metricService.getMetricsByDataSource(dataSourceId);
            setMetrics(result.data ?? result ?? []);
        } catch (err) {
            console.error("[MetricSelector] Error fetching metrics:", err);
            setMetrics([]);
        } finally {
            setLoading(false);
        }
    }
    return (
        <GenericSelector
            wrapInView
            label="Select an Existing Metric"
            title="Select an Existing Metric"
            items={metrics.map((m) => ({ value: m.metricId, label: m.name }))}
            value={selectedMetricId}
            onChange={onMetricSelect}
        />
    );
}
