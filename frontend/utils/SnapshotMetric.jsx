import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import ViewShot from "react-native-view-shot"; // or "expo-view-shot"
import GraphTypes from "../components/modules/day-book/metrics/graph-types";
import { apiGet } from "../../utils/api/apiClient";
import endpoints from "../../utils/api/endpoints";
import { getWorkspaceId } from "../../storage/workspaceStorage";

/**
 * Renders a metric off-screen and calls onSnapshot(dataUrl) once with a PNG data URI.
 * Props:
 *  - metric: { metricId, config, name, ... }
 *  - params: { range, groupBy, ... }   // whatever your API expects
 *  - width, height: snapshot size (pixels)
 *  - onSnapshot(dataUrl: string)
 *  - onError(err)
 */
export default function SnapshotMetric({
  metric,
  params,
  width = 800,
  height = 450,
  onSnapshot,
  onError,
}) {
  const shotRef = useRef(null);
  const [dataRows, setDataRows] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const workspaceId = await getWorkspaceId();
        // get data tailored for the metric (you already do this in ViewMetric)
        const apiResultData = await apiGet(
          endpoints.modules.day_book.data_sources.viewDataForMetric(
            metric.dataSourceId,
            metric.metricId
          ),
          { workspaceId, ...params }
        );
        setDataRows(apiResultData.data || []);
      } catch (e) {
        onError?.(e);
      }
    })();
  }, [metric?.metricId]);

  useEffect(() => {
    // capture once chart has rendered
    if (!shotRef.current || !dataRows) return;
    const t = setTimeout(async () => {
      try {
        const uri = await shotRef.current.capture?.({
          format: "png",
          quality: 1,
          result: "base64",
        });
        onSnapshot?.(`data:image/png;base64,${uri}`);
      } catch (e) {
        onError?.(e);
      }
    }, 120); // small delay lets RN/SVG finish layout
    return () => clearTimeout(t);
  }, [dataRows]);

  if (!dataRows) return null;

  const graphDef = GraphTypes[metric.config.type] || GraphTypes[metric.config.graphType];
  if (!graphDef) {
    onError?.(new Error("Unknown graph type"));
    return null;
  }

  // match your ViewMetric props
  const xKey = metric.config.independentVariable;
  const yKeys = metric.config.dependentVariables;
  const toNumber = (rows) =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => {
          const n = Number(v);
          return [k, Number.isNaN(n) ? v : n];
        })
      )
    );

  return (
    <View
      style={{
        position: "absolute",
        left: -9999, // keep it off-screen
        top: -9999,
        width,
        height,
      }}
      collapsable={false} // important: keep view in native tree for capture
    >
      <ViewShot ref={shotRef} style={{ width, height }}>
        {graphDef.render({
          data: toNumber(dataRows),
          xKey,
          yKeys,
          colours: ["#ef4444", "#3b82f6", "#22c55e", "#a855f7"], // your palette
          width,
          height,
        })}
      </ViewShot>
    </View>
  );
}