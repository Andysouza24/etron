import { getWorkspaceId } from '../storage/workspaceStorage';
import endpoints from '../utils/api/endpoints';
import { apiGet } from '../utils/api/apiClient';

class MetricDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }

    async getMetricData(metricId, dataSourceId) {
        const cacheKey = `${metricId}_${dataSourceId}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const workspaceId = await getWorkspaceId();
            const response = await apiGet(
                endpoints.modules.day_book.data_sources.viewDataForMetric(dataSourceId, metricId),
                { workspaceId }
            );

            const result = {
                data: response.data?.data || [],
                schema: response.data?.schema || []
            };

            // Cache the result
            this.setCache(cacheKey, result);

            return result;
        } catch (error) {
            console.error('Error fetching metric data:', error);
            return null;
        }
    }

    async getBulkMetricData(metrics) {
        const promises = metrics.map(metric =>
            this.getMetricData(metric.metricId, metric.dataSourceId)
                .then(data => ({ metricId: metric.metricId, data }))
                .catch(error => ({ metricId: metric.metricId, error }))
        );

        const results = await Promise.all(promises);
        
        const dataMap = new Map();
        results.forEach(result => {
            if (result.data) {
                dataMap.set(result.metricId, result.data);
            } else {
                console.error(`Failed to fetch data for metric ${result.metricId}:`, result.error);
            }
        });

        return dataMap;
    }

    processDataForChart(data, config) {
        const { independentVariable, dependentVariables, selectedRows } = config;

        let processedData = data.map(row => {
            const newRow = {};
            
            // Convert independent variable
            newRow[independentVariable] = Number(row[independentVariable]) || row[independentVariable];
            
            // Convert dependent variables
            dependentVariables.forEach(key => {
                const valueAsNumber = Number(row[key]);
                newRow[key] = !isNaN(valueAsNumber) ? valueAsNumber : row[key];
            });

            return newRow;
        });

        // Filter by selected rows if specified
        if (selectedRows && selectedRows.length > 0) {
            processedData = processedData.filter(
                row => selectedRows.includes(row[independentVariable])
            );
        }

        return processedData;
    }

    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    clearMetricCache(metricId, dataSourceId) {
        const cacheKey = `${metricId}_${dataSourceId}`;
        this.cache.delete(cacheKey);
    }

    async refreshMetricData(metricId, dataSourceId) {
        this.clearMetricCache(metricId, dataSourceId);
        return this.getMetricData(metricId, dataSourceId);
    }

    getMetricSummary(data, variable) {
        if (!data || data.length === 0) {
            return { count: 0, min: null, max: null, avg: null, sum: null };
        }

        const values = data
            .map(row => Number(row[variable]))
            .filter(val => !isNaN(val));

        if (values.length === 0) {
            return { count: 0, min: null, max: null, avg: null, sum: null };
        }

        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            count: values.length,
            min,
            max,
            avg,
            sum
        };
    }
}

const metricDataService = new MetricDataService();
export default metricDataService;
