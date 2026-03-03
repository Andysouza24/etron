export const onMetricUpdated = /* GraphQL */ `
  subscription OnMetricUpdated($workspaceId: String!) {
    onMetricUpdated(workspaceId: $workspaceId) {
      workspaceId
      metricId
      name
      dataSourceId
      activeDataSource
      metricType
      config
      sourceMetrics
      calculation
      aggregationMethod
      trendDirection
      thumbnailKey
      createdAt
      createdBy
      updatedAt
    }
  }
`;
