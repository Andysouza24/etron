export const onMetricUpdate = /* GraphQL */ `
  subscription OnMetricUpdate($workspaceId: ID!) {
    onMetricUpdate(workspaceId: $workspaceId) {
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

export const onDataUpdate = /* GraphQL */ `
  subscription OnDataUpdate($workspaceId: ID!) {
  onDataUpdate(workspaceId: $workspaceId) {
    workspaceId
    dataSourceId
    metrics
  }
}
`;

export const onDataSourceUpdate = /* GraphQL */ `
  subscription OnDataSourceUpdate($workspaceId: ID!) {
  onDataSourceUpdate(workspaceId: $workspaceId) {
    workspaceId
    dataSourceId
    name
    sourceType
    status
    method
    metrics
    config
    error
    lastUpdate
    createdAt
    updatedAt
    createdBy
  }
}
`