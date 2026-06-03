import { useState, useEffect, useMemo } from 'react';
import { getWorkspaceId } from '../../storage/workspaceStorage';
import endpoints from '../../utils/api/endpoints';
import { apiGet } from '../../utils/api/apiClient';

// Loads the workspace's metrics for the board metric picker, normalizes each
// into the shape the board expects, and owns the search/selection state.
// The parent supplies onSelect (single → fires immediately, multi → on confirm).
export default function useMetricPicker({ multiSelect, onSelect }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [metrics, setMetrics] = useState([]);
    const [filteredMetrics, setFilteredMetrics] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        try {
            setLoading(true);
            setError(null);

            const workspaceId = await getWorkspaceId();
            const endpoint = endpoints.modules.day_book.metrics.getMetrics;
            const queryParams = { workspaceId };

            const response = await apiGet(endpoint, queryParams);

            let metricsData = [];
            if (response && response.data && Array.isArray(response.data)) {
                metricsData = response.data;
            }

            const transformedMetrics = metricsData
                .filter(metric => metric && typeof metric === 'object' && metric.metricId)
                .map(metric => {
                    const rawConfig = metric.config || {};
                    const dependentVariables = Array.isArray(rawConfig.dependentVariables)
                        ? rawConfig.dependentVariables
                        : [];
                    const selectedRows = Array.isArray(rawConfig.selectedRows)
                        ? rawConfig.selectedRows
                        : [];
                    const colours = Array.isArray(rawConfig.colours)
                        ? rawConfig.colours
                        : Array.isArray(rawConfig.colors)
                            ? rawConfig.colors
                            : [];

                    const chartType = rawConfig.type || 'line';
                    const independentVariable = rawConfig.independentVariable;

                    return {
                        id: metric.metricId,
                        metricId: metric.metricId,
                        name: metric.name || 'Unnamed Metric',
                        type: 'metric',
                        dataSourceId: metric.dataSourceId,
                        dataSourceName: metric.dataSourceName || metric.dataSourceLabel || metric.dataSource?.name,
                        chartType,
                        independentVariable,
                        dependentVariables,
                        colours,
                        selectedRows,
                        createdAt: metric.createdAt,
                        updatedAt: metric.updatedAt,
                        config: {
                            ...rawConfig,
                            type: chartType,
                            independentVariable,
                            dependentVariables,
                            selectedRows,
                            colours,
                            colors: rawConfig.colors || colours
                        }
                    };
                });

            setMetrics(transformedMetrics);
            setFilteredMetrics(transformedMetrics);
        } catch (err) {
            console.error('Error loading metrics:', err);
            setError('Failed to load metrics');
            setMetrics([]);
            setFilteredMetrics([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredMetrics(metrics);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = metrics.filter(metric =>
                metric.name?.toLowerCase().includes(query) ||
                metric.chartType?.toLowerCase().includes(query) ||
                metric.dependentVariables?.some(v => v.toLowerCase().includes(query))
            );
            setFilteredMetrics(filtered);
        }
    }, [searchQuery, metrics]);

    const metricsDropdownItems = useMemo(() => {
        const seenMetricIds = new Set();

        return metrics.reduce((acc, metric) => {
            if (!metric || typeof metric !== 'object') {
                return acc;
            }

            const metricId = metric.id ?? metric.metricId;

            if (!metricId || seenMetricIds.has(metricId)) {
                return acc;
            }

            seenMetricIds.add(metricId);
            acc.push({
                value: metricId,
                label: metric.name || 'Unnamed Metric',
                metric
            });

            return acc;
        }, []);
    }, [metrics]);

    const handleToggleMetric = (metric) => {
        if (multiSelect) {
            setSelectedMetrics(prev =>
                prev.some(m => m.id === metric.id)
                    ? prev.filter(m => m.id !== metric.id)
                    : [...prev, metric]
            );
        } else {
            if (onSelect) {
                onSelect(metric);
            }
        }
    };

    const handleConfirm = () => {
        if (onSelect && selectedMetrics.length > 0) {
            onSelect(selectedMetrics);
        }
    };

    const isSelected = (metricId) => {
        return selectedMetrics.some(m => m.id === metricId);
    };

    return {
        searchQuery,
        setSearchQuery,
        metrics,
        filteredMetrics,
        selectedMetrics,
        setSelectedMetrics,
        loading,
        error,
        loadMetrics,
        metricsDropdownItems,
        handleToggleMetric,
        handleConfirm,
        isSelected,
    };
}
