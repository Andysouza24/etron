import { useState, useCallback, useRef, useEffect, useContext } from "react";
import metricDataService from "../services/MetricDataService";
import MetricContext from "../contexts/MetricContext";

// Manages per-board metric data with built-in year filtering.
// Each metric in `metricStates` carries:
//   key, config, data, yKeys, availableYears, selectedYear, loading, error
// `setMetricYear(itemId, year)` triggers a refetch with the chosen year.
export const useMetricStates = (boardItems) => {
  const [metricStates, setMetricStates] = useState({});
  const metricStatesRef = useRef(metricStates);
  // optional: consume per-dataSource update Vals from MetricContext so graphs refetch when the underlying data source data changes
  const metricCtx = useContext(MetricContext);
  const dataUpdateVals = metricCtx?.dataUpdateVals ?? null;
  const dataUpdateValsRef = useRef(dataUpdateVals);

  useEffect(() => {
    metricStatesRef.current = metricStates;
  }, [metricStates]);

  useEffect(() => {
    dataUpdateValsRef.current = dataUpdateVals;
  }, [dataUpdateVals]);

  const fetchMetricDataForItem = useCallback(
    async (itemId, config, stateKey, fetchParams = {}) => {
      try {
        // Pass the data-source update Val as `dataVersion` so the service
        // cache key matches this hook's state key (both bump together when
        // the underlying data source data changes).
        const dataVersion = dataUpdateValsRef.current?.[config.dataSourceId];
        const response = await metricDataService.getMetricData(
          config.metricId,
          config.dataSourceId,
          { ...fetchParams, dataVersion }
        );
        if (!response) {
          throw new Error("No metric data available.");
        }

        const { data: processed, yKeys } = metricDataService.buildChartPayload(
          response,
          config
        );

        setMetricStates((prev) => {
          const current = prev[itemId];
          if (!current || current.key !== stateKey) {
            return prev;
          }

          return {
            ...prev,
            [itemId]: {
              ...current,
              data: processed,
              // Keep the full periods bundle so consumers (e.g. the board
              // metric detail view) can toggle aggregation locally without
              // refetching.
              periods: response.periods ?? null,
              yKeys,
              availableYears: response.availableYears,
              selectedYear: response.appliedFilter?.year ?? null,
              mode: response.mode,
              loading: false,
              error: null,
            },
          };
        });
      } catch (error) {
        console.error(
          `Error fetching data for metric ${config.metricId}:`,
          error
        );

        setMetricStates((prev) => {
          const current = prev[itemId];
          if (!current || current.key !== stateKey) {
            return prev;
          }

          return {
            ...prev,
            [itemId]: {
              ...current,
              loading: false,
              error: error.message || "Failed to load metric data.",
            },
          };
        });
      }
    },
    []
  );

  const ensureMetricState = useCallback(
    (item, options = {}) => {
      const { forceRefresh = false, fetchParams = null } = options;
      const config = item?.config || {};
      const metricId = config.metricId;
      const dataSourceId = config.dataSourceId;
      const dependentVariables = Array.isArray(config.dependentVariables)
        ? config.dependentVariables
        : [];
      const independentVariable = config.independentVariable;

      if (!metricId || !dataSourceId) {
        setMetricStates((prev) => ({
          ...prev,
          [item.id]: {
            key: `${item.id}-invalid`,
            data: [],
            loading: false,
            error: "Metric configuration is incomplete.",
          },
        }));
        return;
      }

      if (!independentVariable || dependentVariables.length === 0) {
        setMetricStates((prev) => ({
          ...prev,
          [item.id]: {
            key: `${item.id}-missing-variables`,
            data: [],
            loading: false,
            error: "Metric is missing independent or dependent variables.",
          },
        }));
        return;
      }

      const keyParts = [
        metricId,
        dataSourceId,
        independentVariable,
        dependentVariables.join("|"),
      ];
      if (
        Array.isArray(config.selectedRows) &&
        config.selectedRows.length > 0
      ) {
        keyParts.push(`rows:${config.selectedRows.join("|")}`);
      }
      // include data-source update Val so a fresh fetch is triggered when the data source's underlying data changes
      const Val = dataUpdateValsRef.current?.[dataSourceId];
      if (Val) {
        keyParts.push(`Val:${Val}`);
      }
      const stateKey = keyParts.join("::");
      const existing = metricStatesRef.current?.[item.id];

      // skip refetch when the key is unchanged. this covers loaded,
      // in-flight, and previously-errored states — retries only happen
      // when something in the key actually changes (e.g. data-source
      // update Val bumps) or when forceRefresh is passed
      if (!forceRefresh && existing && existing.key === stateKey) {
        return;
      }

      setMetricStates((prev) => ({
        ...prev,
        [item.id]: {
          key: stateKey,
          config,
          data: existing?.key === stateKey ? existing.data : [],
          yKeys: existing?.key === stateKey ? existing.yKeys : [],
          availableYears: existing?.key === stateKey ? existing.availableYears : null,
          selectedYear: existing?.key === stateKey ? existing.selectedYear : null,
          loading: true,
          error: null,
        },
      }));

      // First load: let the backend pick the default year (most recent).
      fetchMetricDataForItem(item.id, config, stateKey, fetchParams || {});
    },
    [fetchMetricDataForItem]
  );

  // Re-fetch a metric for a specific year. Pass `"all"` to fetch the entire
  // range (subject to backend nextToken safety valve).
  const setMetricYear = useCallback(
    (itemId, year) => {
      const current = metricStatesRef.current?.[itemId];
      if (!current || !current.config) return;
      if (current.selectedYear === year && !current.error) return;

      setMetricStates((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          selectedYear: year,
          loading: true,
          error: null,
        },
      }));

      fetchMetricDataForItem(itemId, current.config, current.key, { year });
    },
    [fetchMetricDataForItem]
  );

  useEffect(() => {
    if (!boardItems) {
      setMetricStates({});
      return;
    }

    const metricItems = boardItems.filter((item) => item?.type === "metric");

    setMetricStates((prev) => {
      if (!metricItems.length) {
        return {};
      }

      const next = {};
      metricItems.forEach((item) => {
        if (prev[item.id]) {
          next[item.id] = prev[item.id];
        }
      });
      return next;
    });

    metricItems.forEach((item) => ensureMetricState(item));
  }, [boardItems, ensureMetricState]);

  // re-evaluate states when data-source update Vals change so cached graphs refresh after the underlying data source data updates
  useEffect(() => {
    if (!boardItems || !dataUpdateVals) return;
    boardItems
      .filter((item) => item?.type === "metric")
      .forEach((item) => ensureMetricState(item));
  }, [dataUpdateVals, boardItems, ensureMetricState]);

  return {
    metricStates,
    ensureMetricState,
    setMetricYear,
  };
};
