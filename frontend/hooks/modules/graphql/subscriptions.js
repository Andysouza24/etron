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
    progressStage
    progressPercent
    lastUpdate
    createdAt
    updatedAt
    createdBy
  }
}
`;

export const onBoardUpdate = /* GraphQL */ `
  subscription OnBoardUpdate($workspaceId: ID!) {
    onBoardUpdate(workspaceId: $workspaceId) {
      workspaceId
      boardId
      name
      config
      isDashboard
      updatedAt
      action
    }
  }
`;