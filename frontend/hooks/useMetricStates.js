import { useState, useCallback, useRef, useEffect } from "react";
import metricDataService from "../services/MetricDataService";

export const useMetricStates = (boardItems) => {
  const [metricStates, setMetricStates] = useState({});
  const metricStatesRef = useRef(metricStates);

  useEffect(() => {
    metricStatesRef.current = metricStates;
  }, [metricStates]);

  const fetchMetricDataForItem = useCallback(
    async (itemId, config, stateKey) => {
      try {
        const rawData = await metricDataService.getMetricData(
          config.metricId,
          config.dataSourceId
        );
        if (!rawData) {
          throw new Error("No metric data available.");
        }

        const processed = metricDataService.processDataForChart(
          rawData.data || [],
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
      const { forceRefresh = false } = options;
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
      const stateKey = keyParts.join("::");
      const existing = metricStatesRef.current?.[item.id];

      if (
        !forceRefresh &&
        existing &&
        existing.key === stateKey &&
        !existing.loading &&
        !existing.error
      ) {
        return;
      }

      setMetricStates((prev) => ({
        ...prev,
        [item.id]: {
          key: stateKey,
          config,
          data: existing?.key === stateKey ? existing.data : [],
          loading: true,
          error: null,
        },
      }));

      fetchMetricDataForItem(item.id, config, stateKey);
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

  return {
    metricStates,
    ensureMetricState,
  };
};
