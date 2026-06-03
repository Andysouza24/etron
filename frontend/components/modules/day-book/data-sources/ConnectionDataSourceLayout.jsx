import React, { useState, useEffect, useCallback } from "react";
import { View, Alert } from "react-native";
import { ScrollView } from "react-native";
import { useTheme, Text, Searchbar } from "react-native-paper";
import { router } from "expo-router";
import { getCurrentUser } from "aws-amplify/auth";

import Header from "../../../layout/Header";
import { commonStyles } from "../../../../assets/styles/stylesheets/common";
import DataButton from "../../../common/buttons/DataButton";
import AccountCard from "../../../cards/accountCard";
import FilterBar from "../../../layout/FilterBar";
import StackLayout from "../../../layout/StackLayout";
import BasicButton from "../../../common/buttons/BasicButton";
import IconButton from "../../../common/buttons/IconButton";
import Divider from "../../../layout/Divider";
import SearchFilterCard from "../../../cards/SearchFilterCard";
import useDataSources from "../../../../hooks/modules/day_book/data-sources/useDataSource";

// Status components
const LoadingView = ({ title, message }) => (
  <View style={commonStyles.screen}>
    <Header title={title} showBack />
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{message}</Text>
    </View>
  </View>
);

const StatusCard = ({ children, backgroundColor, textColor }) => (
  <View style={{ padding: 15, backgroundColor, borderRadius: 8 }}>
    <Text style={{ color: textColor, textAlign: "center" }}>{children}</Text>
  </View>
);

const ConnectionDataSourceLayout = ({
  title,
  adapterType,
  adapterDependencies,
  serviceDisplayName,
  getItemDescription,
  getItemIcon,
  showLocationFilter = false,
  searchPlaceholder,
  emptyStateMessage,
  demoModeMessage,
  enablePersistentConnection = false,
  dataSourceName,
  dataManagementPath = "/modules/day-book/data-management",
  getNavigationParams,
  getAdapterFilterOptions,
}) => {
  const theme = useTheme();
  const filterOptions = ["All", "OneDrive", "Sharepoint"];

  // Use the updated data sources hook
  const {
    dataSources: connectedDataSources,
    loading: dataSourcesLoading,
    error: dataSourcesError,
    connectDataSource,
    isDemoModeActive,
    connectProvider,
    disconnectProvider,
    isProviderConnected,
    getProviderConnection,
  } = useDataSources();

  // Local state
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [availableDataSources, setAvailableDataSources] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [locationFilter, setLocationFilter] = useState({
    label: "All",
    count: 0,
    value: "All",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isProviderConnectedStatus = isProviderConnected(adapterType);
  const providerConnection = getProviderConnection(adapterType);
  const isDemoMode = isDemoModeActive();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setConnectionInfo(user);
      } catch (error) {
        console.error("No authenticated user:", error);
        setConnectionInfo(null);
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  // Auto-fetch data when provider is connected
  useEffect(() => {
    if (
      isProviderConnectedStatus &&
      availableDataSources.length === 0 &&
      !dataLoading
    ) {
      handleFetchData();
    }
  }, [isProviderConnectedStatus]);

  const handleConnect = useCallback(async () => {
    console.log("handle connect called");
    setIsConnecting(true);
    setError(null);

    try {
      console.log("Connecting to", serviceDisplayName, "provider...");

      // Connect to the provider (stored separately, doesn't appear in data sources list)
      await connectProvider(adapterType);

      console.log(`${serviceDisplayName} provider connection successful`);
    } catch (error) {
      console.error("Provider connection failed:", error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectProvider, adapterType, serviceDisplayName]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectProvider(adapterType);
      setAvailableDataSources([]);
      setSelectedItem(null);
      console.log(`${serviceDisplayName} provider disconnected`);
    } catch (error) {
      console.error("Provider disconnection failed:", error);
      setError(error.message);
    }
  }, [disconnectProvider, adapterType, serviceDisplayName]);

  const handleFetchData = useCallback(async () => {
    if (dataLoading || !isProviderConnectedStatus) return;

    setDataLoading(true);
    setError(null);

    try {
      const mockData = generateMockData(adapterType);
      setAvailableDataSources(mockData);
      setSelectedItem(null);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      Alert.alert(
        "Error",
        `Failed to fetch ${serviceDisplayName.toLowerCase()} data.`
      );
    } finally {
      setDataLoading(false);
    }
  }, [dataLoading, isProviderConnectedStatus, adapterType, serviceDisplayName]);

  // Generate mock data based on adapter type (replace with actual data fetching)
  const generateMockData = (type) => {
    const baseItems = Array.from({ length: 5 }, (_, i) => ({
      id: `${type}_item_${i + 1}`,
      name: `${serviceDisplayName} Item ${i + 1}`,
      lastModified: new Date(
        Date.now() - Math.random() * 10000000000
      ).toISOString(),
      mimeType:
        type === "google-sheets"
          ? "application/vnd.google-apps.spreadsheet"
          : "application/octet-stream",
      size: Math.floor(Math.random() * 1000000),
      url: `https://example.com/${type}/${i + 1}`,
      location: i % 2 === 0 ? "Folder A" : "Folder B",
      status: "available",
      connected: true,
      type: type,
      provider: serviceDisplayName,
    }));

    return baseItems;
  };

  // Handle item selection (for continue button) or direct connection
  const handleItemSelect = useCallback(
    (item) => {
      setSelectedItem(selectedItem?.id === item.id ? null : item);
    },
    [selectedItem]
  );

  // Handle continue button press
  const handleContinue = useCallback(async () => {
    if (!selectedItem || !isProviderConnectedStatus) return;

    try {
      await connectDataSource(
        adapterType,
        {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          ...selectedItem,
        },
        selectedItem.name
      );

      const navigationParams = getNavigationParams
        ? getNavigationParams(selectedItem, null, {
            currentDataSource: providerConnection,
            isPersistent: enablePersistentConnection,
          })
        : getDefaultNavigationParams(selectedItem);

      const navigationData = {
        pathname: dataManagementPath,
        params: navigationParams,
      };

      router.navigate(navigationData);
    } catch (error) {
      console.error("Error connecting data source:", error);
      Alert.alert(
        "Error",
        `Failed to connect to ${selectedItem.name}: ${error.message}`
      );
    }
  }, [
    selectedItem,
    isProviderConnectedStatus,
    connectDataSource,
    adapterType,
    getNavigationParams,
    enablePersistentConnection,
    dataManagementPath,
    providerConnection,
  ]);

  const getDefaultNavigationParams = (item) => {
    const baseParams = {
      type: adapterType,
      name: item.name,
      isPersistent: enablePersistentConnection ? "true" : "false",
      providerId: providerConnection?.id,
    };

    switch (adapterType) {
      case "google-sheets":
        return { ...baseParams, spreadsheetId: item.id, url: item.url };
      case "google-drive":
      case "dropbox":
      case "onedrive":
        return { ...baseParams, fileId: item.id, mimeType: item.mimeType };
      default:
        return { ...baseParams, itemId: item.id };
    }
  };

  // Filter and search
  const filterDataSources = useCallback(
    (query, locationFilter = "All") => {
      return availableDataSources.filter((item) => {
        const matchesSearch =
          !query || item.name.toLowerCase().includes(query.toLowerCase());
        const matchesLocation =
          locationFilter === "All" || item.location === locationFilter;
        return matchesSearch && matchesLocation;
      });
    },
    [availableDataSources]
  );

  const getFilterOptions = useCallback(() => {
    console.log(showLocationFilter);
    if (!showLocationFilter || availableDataSources.length === 0) {
      return [
        { label: "All", count: availableDataSources.length, value: "All" },
      ];
    }

    const locationCounts = availableDataSources.reduce((acc, item) => {
      const location = item.location || "Default";
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    return [
      { label: "All", count: availableDataSources.length, value: "All" },
      ...Object.entries(locationCounts).map(([location, count]) => ({
        label: location,
        count,
        value: location,
      })),
    ];
  }, [showLocationFilter, availableDataSources]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "Unknown date";

    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch (e) {
      console.warn("Date formatting error:", e);
      return "Invalid date";
    }
  }, []);

  const filteredDataSources = filterDataSources(
    searchQuery,
    locationFilter.value
  );
  const accountInfo = connectionInfo
    ? {
        name: connectionInfo?.name || `${serviceDisplayName} User`,
        email:
          connectionInfo.signInDetails?.loginId ||
          connectionInfo.username ||
          "Demo User",
      }
    : null;

  // Loading states
  if (dataSourcesLoading && !authChecked) {
    return <LoadingView title={title} message="Loading..." />;
  }

  return (
    <View style={commonStyles.screen}>
      <Header title={title} showBack />
      <ScrollView
        contentContainerStyle={commonStyles}
        style={{ marginBottom: 80 }}
      >
        <StackLayout spacing={20}>
          {/* Error Display */}
          {(error || dataSourcesError) && (
            <StatusCard
              backgroundColor={theme.colors.errorContainer}
              textColor={theme.colors.onErrorContainer}
            >
              {error || dataSourcesError}
            </StatusCard>
          )}

          {/* Demo Mode Indicator */}
          {isDemoMode && (
            <StatusCard
              backgroundColor={theme.colors.secondaryContainer}
              textColor={theme.colors.onSecondaryContainer}
            >
              Demo Mode Active{"\n"}
              {demoModeMessage ||
                `Using sample ${serviceDisplayName} data for development`}
            </StatusCard>
          )}

          {/* Connection Status */}
          {!isProviderConnectedStatus && authChecked && (
            <StackLayout spacing={15}>
              <Text style={[commonStyles.titleText, { textAlign: "center" }]}>
                Connect {serviceDisplayName}
              </Text>
              <Text style={{ textAlign: "center" }}>
                Connect your {serviceDisplayName} account to access your data
                {enablePersistentConnection &&
                  " and save the connection for future use"}
              </Text>
              <BasicButton
                label={
                  isConnecting
                    ? "Connecting..."
                    : `Connect with ${serviceDisplayName}`
                }
                onPress={handleConnect}
                disabled={dataSourcesLoading || isConnecting}
              />
            </StackLayout>
          )}

          {/* Connected Account */}
          {isProviderConnectedStatus && accountInfo && (
            <AccountCard
              account={accountInfo}
              loading={dataLoading}
              onPress={() => {
                Alert.alert(
                  `Switch ${serviceDisplayName} Account`,
                  `This will disconnect your current ${serviceDisplayName} account and allow you to sign in with a different account.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Switch",
                      onPress: () => {
                        handleDisconnect();
                        // Optionally navigate to login or re-trigger connection
                        // router.navigate('/login-signup');
                      },
                    },
                  ]
                );
              }}
            />
          )}

          {/* Data Sources List */}
          {isProviderConnectedStatus && (
            <StackLayout spacing={20}>
              <Divider color={theme.colors.divider} />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600" }}>
                  Your {serviceDisplayName} Data
                </Text>
                <Text
                  style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}
                >
                  {availableDataSources.length} found
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Select an item and press Continue
              </Text>

              {/* Search and Filter */}
              {showLocationFilter ? (
                <SearchFilterCard
                  mode="elevated"
                  child={
                    <StackLayout
                      spacing={8}
                      style={{ flex: 1, alignSelf: "stretch" }}
                    >
                      <Searchbar
                        placeholder={
                          searchPlaceholder ||
                          `Search ${serviceDisplayName.toLowerCase()} files`
                        }
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={[
                          commonStyles.searchBar,
                          { backgroundColor: theme.colors.buttonBackground },
                        ]}
                        placeholderTextColor={theme.colors.divider}
                        iconColor={theme.colors.themeGrey}
                      />
                      {availableDataSources.length > 0 && (
                        <FilterBar
                          filters={filterOptions}
                          activeFilter={locationFilter}
                          onFilterChange={setLocationFilter}
                        />
                      )}
                    </StackLayout>
                  }
                />
              ) : (
                <Searchbar
                  placeholder={
                    searchPlaceholder ||
                    `Search ${serviceDisplayName.toLowerCase()}`
                  }
                  onChangeText={setSearchQuery}
                  value={searchQuery}
                  style={[
                    commonStyles.searchBar,
                    { backgroundColor: theme.colors.buttonBackground },
                  ]}
                />
              )}

              <StackLayout spacing={15}>
                {dataLoading ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text>
                      Loading {serviceDisplayName.toLowerCase()} data...
                    </Text>
                  </View>
                ) : availableDataSources.length === 0 ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ textAlign: "center" }}>
                      {emptyStateMessage ||
                        `No ${serviceDisplayName.toLowerCase()} data found`}
                    </Text>
                    <BasicButton
                      label="Refresh"
                      onPress={handleFetchData}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                ) : (
                  <StackLayout spacing={2}>
                    {filteredDataSources.map((item) => (
                      <DataButton
                        key={item.id}
                        label={item.name}
                        description={
                          getItemDescription
                            ? getItemDescription(item, formatDate)
                            : `Last modified: ${formatDate(item.lastModified)}`
                        }
                        icon={getItemIcon ? getItemIcon(item) : "file"}
                        onPress={() => handleItemSelect(item)}
                        selected={selectedItem?.id === item.id}
                      />
                    ))}
                  </StackLayout>
                )}

                {availableDataSources.length > 0 && (
                  <View style={{ alignItems: "flex-end" }}>
                    <IconButton
                      label={dataLoading ? "Loading..." : "Refresh List"}
                      onPress={handleFetchData}
                      loading={dataLoading}
                      icon="refresh"
                    />
                  </View>
                )}
              </StackLayout>
            </StackLayout>
          )}
        </StackLayout>
      </ScrollView>

      {/* Continue Button */}
      <View style={commonStyles.floatingButtonContainer}>
        <BasicButton
          label="Continue"
          disabled={!selectedItem}
          onPress={handleContinue}
          fullWidth={false}
        />
      </View>
    </View>
  );
};

export default ConnectionDataSourceLayout;
