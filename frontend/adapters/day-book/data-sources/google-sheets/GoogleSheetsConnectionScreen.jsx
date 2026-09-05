import React from "react";

import ConnectionDataSourceLayout from "../../../../components/modules/day-book/data-sources/ConnectionDataSourceLayout";

const GoogleSheetsConnectionScreen = () => {
  const getItemDescription = (dataSource, formatDateFn) =>
    `Status: ${dataSource.status} • Last Modified: ${formatDateFn(dataSource.lastModified)}`;
  const getItemIcon = () => "google-spreadsheet";

  return (
    <ConnectionDataSourceLayout
      title="Google Sheets"
      adapterType="google-sheets"
      serviceDisplayName="Google Sheets"
      getItemDescription={getItemDescription}
      getItemIcon={getItemIcon}
      showLocationFilter={false}
      searchPlaceholder="Search Google Sheets connections"
      emptyStateMessage="No Google Sheets connections found"
      demoModeMessage="Using sample Google Sheets data for development"
      enablePersistentConnection={true}
      dataSourceName="My Google Sheets Connection"
      dataManagementPath="/modules/day-book/data-management"
    />
  );
};

export default GoogleSheetsConnectionScreen;
