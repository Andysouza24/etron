import { getWorkspaceId } from '../storage/workspaceStorage';
import endpoints from '../utils/api/endpoints';
import { apiGet, apiPost } from '../utils/api/apiClient';
import { buildMetricGraphData } from '../utils/metricGraphData';

class MetricDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
        // Caching is keyed by (metricId, dataSourceId, year, dataVersion).
        // `dataVersion` is the AppSync-driven counter from MetricContext that
        // bumps whenever the underlying data source data changes, so when the
        // data source updates the next call is a cache miss and refetches.
        this.cachingEnabled = true;
    }

    // Cache only the merged result of `fetchAllPages` — per-page intermediate
    // calls flow through `getMetricData` directly without touching the cache.
    #buildBundleCacheKey(metricId, dataSourceId, params = {}) {
        if (!metricId || !dataSourceId) return null;
        const year = params.year ?? "";
        const dataVersion = params.dataVersion ?? "";
        return `bundle::${metricId}::${dataSourceId}::${year}::${dataVersion}`;
    }

    async getMetricData(metricId, dataSourceId, params = {}) {
        try {
            const workspaceId = await getWorkspaceId();
            const queryParams = { workspaceId };
            if (params.year != null) queryParams.year = params.year;
            if (params.from) queryParams.from = params.from;
            if (params.to) queryParams.to = params.to;
            if (params.aggregatePeriod) queryParams.aggregatePeriod = params.aggregatePeriod;
            if (params.pageSize) queryParams.pageSize = params.pageSize;
            if (params.nextToken) queryParams.nextToken = params.nextToken;
            if (params.queryExecutionId) queryParams.queryExecutionId = params.queryExecutionId;

            const response = await apiGet(
                endpoints.modules.day_book.data_sources.viewDataForMetric(dataSourceId, metricId),
                queryParams
            );

            const payload = response.data || {};
            const result = {
                data: Array.isArray(payload.data) ? payload.data : [],
                // When the backend ran a single GROUPING SETS query it
                // ships all four aggregation views in one response so the
                // frontend can toggle without another network call.
                periods: payload.periods && typeof payload.periods === "object"
                    ? {
                        daily: Array.isArray(payload.periods.daily) ? payload.periods.daily : [],
                        weekly: Array.isArray(payload.periods.weekly) ? payload.periods.weekly : [],
                        monthly: Array.isArray(payload.periods.monthly) ? payload.periods.monthly : [],
                        yearly: Array.isArray(payload.periods.yearly) ? payload.periods.yearly : [],
                    }
                    : null,
                schema: payload.schema || [],
                yKeys: Array.isArray(payload.yKeys) ? payload.yKeys : null,
                availableYears: Array.isArray(payload.availableYears) ? payload.availableYears : null,
                appliedFilter: payload.appliedFilter || {},
                mode: payload.mode || null,
                preShaped: !!payload.preShaped,
                nextToken: payload.nextToken || null,
                queryExecutionId: payload.queryExecutionId || null,
            };

            return result;
        } catch (error) {
            console.error('[MetricDataService] getMetricData:', error);
            return null;
        }
    }

    // Walk every page of a metric query and return one merged response.
    //
    // The first page drives the metadata (schema, yKeys, availableYears,
    // appliedFilter, mode, preShaped). Subsequent pages re-use the same
    // Athena `queryExecutionId` so the SQL only runs once; we just keep
    // pulling more rows until the backend stops returning `nextToken`.
    //
    // `onPage` is optional. When provided, it is called with the cumulative
    // result after each page so callers can render progressively.
    // `maxPages` is a safety valve to avoid runaway loops if the backend
    // ever returns malformed paging.
    async fetchAllPages(metricId, dataSourceId, params = {}, { onPage, maxPages = 200 } = {}) {
        const cacheKey = this.#buildBundleCacheKey(metricId, dataSourceId, params);
        if (this.cachingEnabled && cacheKey) {
            const cached = this.getCached(cacheKey);
            if (cached) {
                if (typeof onPage === "function") onPage(cached);
                return cached;
            }
        }

        const first = await this.getMetricData(metricId, dataSourceId, params);
        if (!first) return null;

        const merged = {
            ...first,
            data: [...first.data],
            periods: first.periods ? {
                daily: [...first.periods.daily],
                weekly: [...first.periods.weekly],
                monthly: [...first.periods.monthly],
                yearly: [...first.periods.yearly],
            } : null,
            // The merged response represents the full dataset, so consumers
            // shouldn't be tempted to page further from it.
            nextToken: null,
        };
        if (typeof onPage === "function") onPage(merged);

        let nextToken = first.nextToken;
        const queryExecutionId = first.queryExecutionId;
        let pagesFetched = 1;

        while (nextToken && queryExecutionId && pagesFetched < maxPages) {
            const page = await this.getMetricData(metricId, dataSourceId, {
                ...params,
                nextToken,
                queryExecutionId,
            });
            if (!page) break;
            let progressed = false;
            if (Array.isArray(page.data) && page.data.length > 0) {
                merged.data.push(...page.data);
                progressed = true;
            }
            if (page.periods && merged.periods) {
                for (const key of ["daily", "weekly", "monthly", "yearly"]) {
                    if (Array.isArray(page.periods[key]) && page.periods[key].length > 0) {
                        merged.periods[key].push(...page.periods[key]);
                        progressed = true;
                    }
                }
            }
            if (progressed && typeof onPage === "function") onPage(merged);
            nextToken = page.nextToken;
            pagesFetched += 1;
        }

        if (nextToken) {
            console.warn(
                `[MetricDataService] fetchAllPages hit maxPages=${maxPages} for metric ${metricId} with nextToken still set.`
            );
        }

        if (this.cachingEnabled && cacheKey) {
            this.setCache(cacheKey, merged);
        }

        return merged;
    }

    // Run the same backend pipeline as `getMetricData` against an unsaved
    // config. Used by the metric creation wizard so the preview matches the
    // saved view-metric chart exactly.
    async previewMetricData(dataSourceId, config, params = {}) {
        try {
            if (!dataSourceId || !config) return null;
            const workspaceId = await getWorkspaceId();
            const response = await apiPost(
                endpoints.modules.day_book.data_sources.previewMetricData(dataSourceId),
                {
                    config,
                    year: params.year,
                    from: params.from,
                    to: params.to,
                    aggregatePeriod: params.aggregatePeriod,
                    nextToken: params.nextToken,
                    queryExecutionId: params.queryExecutionId,
                },
                { workspaceId }
            );

            const payload = response?.data || response || {};
            return {
                data: Array.isArray(payload.data) ? payload.data : [],
                schema: payload.schema || [],
                yKeys: Array.isArray(payload.yKeys) ? payload.yKeys : null,
                availableYears: Array.isArray(payload.availableYears) ? payload.availableYears : null,
                appliedFilter: payload.appliedFilter || {},
                mode: payload.mode || null,
                preShaped: !!payload.preShaped,
                nextToken: payload.nextToken || null,
                queryExecutionId: payload.queryExecutionId || null,
            };
        } catch (error) {
            console.error('[MetricDataService] previewMetricData:', error);
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

    processDataForChart(data, config, schema = null) {
        const { data: processed } = buildMetricGraphData(data, config, schema);
        return processed;
    }

    // Build the { data, yKeys } pair the chart components consume.
    // Accepts the full response object so it can short-circuit when the
    // backend already pre-shaped the data (Option 1 + Option 4 path), or
    // fall back to the legacy client-side pipeline for older responses.
    buildChartPayload(response, config) {
        if (response && response.preShaped && Array.isArray(response.data)) {
            const yKeys = Array.isArray(response.yKeys) && response.yKeys.length > 0
                ? response.yKeys
                : (Array.isArray(config?.dependentVariables) ? config.dependentVariables : []);
            return { data: response.data, yKeys };
        }
        const rows = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        const schema = response?.schema || null;
        return buildMetricGraphData(rows, config, schema);
    }

    // Return the rows for a specific aggregation period, when the backend
    // shipped a multi-period bundle. Falls back to `response.data` so single
    // -period responses and non-bucketable metrics keep working unchanged.
    getPeriodSlice(response, period) {
        if (!response) return [];
        if (response.periods && period && Array.isArray(response.periods[period])) {
            return response.periods[period];
        }
        return Array.isArray(response.data) ? response.data : [];
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
        const suffix = `::${metricId}::${dataSourceId}::`;
        for (const key of this.cache.keys()) {
            if (key.includes(suffix)) {
                this.cache.delete(key);
            }
        }
    }

    // Drop every cached bundle that depends on the given data source. Called
    // when the data source data changes so subsequent reads refetch fresh
    // rows rather than serve stale slices from cache.
    clearCacheForDataSource(dataSourceId) {
        if (!dataSourceId) return;
        const marker = `::${dataSourceId}::`;
        for (const key of this.cache.keys()) {
            if (key.includes(marker)) {
                this.cache.delete(key);
            }
        }
    }

    async refreshMetricData(metricId, dataSourceId, params = {}) {
        this.clearMetricCache(metricId, dataSourceId);
        return this.getMetricData(metricId, dataSourceId, params);
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
