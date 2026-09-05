import React from "react";

import ConnectionDataSourceLayout from "../../../../components/modules/day-book/data-sources/ConnectionDataSourceLayout";

const ExcelConnectionScreen = () => {
  const getItemDescription = (dataSource, formatDateFn) =>
    `Status: ${dataSource.status} • Last Modified: ${formatDateFn(dataSource.lastModified)}`;
  const getItemIcon = () => "microsoft-excel";

  return (
    <ConnectionDataSourceLayout
      title="Excel"
      adapterType="microsoft-excel"
      serviceDisplayName="Microsoft Excel"
      getItemDescription={getItemDescription}
      getItemIcon={getItemIcon}
      showLocationFilter={false}
      searchPlaceholder="Search Excel connections"
      emptyStateMessage="No Excel connections found"
      demoModeMessage="Using sample Excel files for development"
      enablePersistentConnection={true}
      dataSourceName="My Excel Connection"
      dataManagementPath="/modules/day-book/data-management"
    />
  );
};

export default ExcelConnectionScreen;
