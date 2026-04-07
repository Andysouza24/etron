import { View, Alert, ScrollView } from "react-native";
import { useTheme, Text } from "react-native-paper";
import { router } from "expo-router";
import { useState, useEffect, useMemo } from "react";

import Header from "./Header";
import StackLayout from "./StackLayout";
import BasicButton from "../../components/common/buttons/BasicButton";
import IconButton from "../../components/common/buttons/IconButton";
import TestResultCard from "../../components/cards/testResultCard";
import ConnectionDialog from "../../components/overlays/ConnectionDialog";
import CollapsibleList from "./CollapsibleList";
import Divider from "./Divider";

import { commonStyles } from "../../assets/styles/stylesheets/common";
import { useDataSourceContext } from "../../contexts/DataSourceContext";
import { createDataAdapter } from "../../adapters/day-book/data-sources";
import { apiPost } from "../../utils/api/apiClient";
import endpoints from "../../utils/api/endpoints";
import { getCurrentUser, fetchAuthSession, signOut } from "aws-amplify/auth";
import ResponsiveScreen from "./ResponsiveScreen";

// --- Test Connection Section ---
const TestConnectionSection = ({
  isTestingConnection, testResponse, connectionError,
  onTestConnection, canTest, theme
}) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <StackLayout spacing={15}>
      <Text style={[commonStyles.captionText, { color: theme.colors.onSurfaceVariant }]}>
        Test your connection before creating it to ensure everything works correctly.
      </Text>
      <IconButton
        label={isTestingConnection ? "Testing..." : "Test Connection"}
        icon="connection"
        onPress={onTestConnection}
        loading={isTestingConnection}
        disabled={!canTest}
        backgroundColor={theme.colors.primary}
      />
      {testResponse && (
        <>
          <Divider color={theme.colors.buttonBackground} />
          <TestResultCard result={testResponse} title="Test Results" />
        </>
      )}
      {connectionError && (
        <>
          <Divider color={theme.colors.buttonBackground} />
          <TestResultCard error={connectionError} title="Connection Error" />
        </>
      )}
    </StackLayout>
  </View>
);

// --- Main Page ---
const ConnectionPage = ({
  connectionType,
  title,
  FormComponent,
  formValidator,
  connectionDataBuilder,
  nameGenerator
}) => {
  const theme = useTheme();
  const {
  dataSources: { list: dataSources },
  connectDataSource, testConnection: testDataSourceConnection,
  } = useDataSourceContext();

  // State
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [connection, setConnection] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [testResponse, setTestResponse] = useState(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [adapter, setAdapter] = useState(null);
  const [adapterError, setAdapterError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set(['form']));

  // Adapter setup
  useEffect(() => {
    try {
  console.log('[ConnectionPage] creating adapter', { connectionType });
      const apiClient = {
        post: apiPost,
        get: async () => ({ data: [] }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
      };
      const authService = { getCurrentUser, fetchAuthSession, signOut };
    const newAdapter = createDataAdapter(connectionType, {
        authService,
        apiClient,
        endpoints,
        options: {
      // Do not allow automatic fallback to demo when creating a UI adapter
      fallbackToDemo: false
        }
      });
      if (!newAdapter) throw new Error('Failed to create adapter - adapter is null');
      setAdapter(newAdapter);
      setAdapterError(null);
    } catch (err) {
      setAdapterError(`Failed to create adapter: ${err.message}`);
  console.error('[ConnectionPage] Adapter creation error:', err);
    }
  }, [connectionType]);

  // Expand test section when form valid
  const formIsValid = useMemo(() => formValidator ? formValidator(formData) : true, [formData, formValidator]);
  useEffect(() => {
    if (formIsValid && !isConnected()) {
      setExpandedSections(prev => new Set([...prev, 'test']));
    }
    // eslint-disable-next-line
  }, [formIsValid, isConnected]);

  // When the endpoint/URL changes, clear previous test results to force re-test
  useEffect(() => {
    // For API-based connections, the primary field is usually `url` or `endpoint`
    setTestResponse(null);
    setConnectionError(null);
  }, [formData?.url, formData?.endpoint]);

  // Accordion toggle
  const handleSectionToggle = (sectionKey) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      newSet.has(sectionKey) ? newSet.delete(sectionKey) : newSet.add(sectionKey);
      return newSet;
    });
  };

  // Name generator
  const generateName = () => {
    if (nameGenerator && !formData.name) {
      const generatedName = nameGenerator(formData);
      if (generatedName) return generatedName;
    }
  };

  // Auto-apply generated name to formData when URL/endpoint present and name empty
  useEffect(() => {
    if (!formData.name && (formData.url || formData.endpoint) && nameGenerator) {
      try {
        const generated = nameGenerator(formData);
        if (generated) {
          setFormData(prev => ({ ...prev, name: generated }));
        }
      } catch {}
    }
  }, [formData.url, formData.endpoint, formData.name, nameGenerator]);

  // Form validation
  const validateForm = () => {
    if (!formValidator) return true;
    const validation = formValidator(formData, true);
    if (validation === true) {
      setErrors({});
      return true;
    }
    setErrors(validation || {});
    return false;
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!validateForm()) return;
    if (!adapter) {
      setConnectionError("Adapter not initialized");
      return;
    }
    setIsTestingConnection(true);
    setConnectionError(null);
    setTestResponse(null);
    try {
      const connectionData = connectionDataBuilder ? connectionDataBuilder(formData) : formData;
      const connectionName = formData.name || generateName() || `${title} Connection`;
  const result = await testDataSourceConnection(connectionType, connectionData, connectionName);
      setTestResponse(result);
      setConnectionError(null);
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionError(error.message || "Failed to test connection");
      setTestResponse(null);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Create connection
  const handleContinue = async () => {
    setIsCreatingConnection(true);
    try {
      const connectionData = connectionDataBuilder ? connectionDataBuilder(formData) : formData;
      const connectionName = formData.name || generateName() || `${title} Connection`;
  console.log('[ConnectionPage] calling connectDataSource', { type: connectionType, name: connectionName });
  const result = await connectDataSource(connectionType, connectionData, connectionName);
      if (!result || !result.id) {
        throw new Error('Backend did not confirm creation (missing id)');
      }
      if (result) {
        const dialogData = formatConnectionForDialog(result, connectionType, testResponse);
        setConnection(dialogData);
        setShowSuccessDialog(true);
      } else {
        Alert.alert("Connection Failed", "Unable to create connection. Please try again.");
      }
    } catch (error) {
      console.error('Connection creation error:', error);
      Alert.alert("Error", `Failed to create connection: ${error.message}`);
    } finally {
      setIsCreatingConnection(false);
    }
  };

  // Format dialog data
  const formatConnectionForDialog = (connection, type, testResult) => {
    const baseData = {
      name: connection.name,
      status: connection.status || 'connected',
      createdAt: connection.createdAt || new Date().toISOString(),
      testResult: testResult?.status === 'success' ? testResult.data : null,
      originalConnection: connection,
      isDemoMode: false
    };
    const formatters = {
    'custom-api': (conn) => ({
        ...baseData,
        title: `API Connection Created`,
        message: `Your custom API connection has been successfully created and is ready to use.`,
        details: [
      { label: "Endpoint", value: conn.config?.endpoint ?? '' },
          { label: "Type", value: "REST API" },
      { label: "Authentication", value: conn.config?.authType ? "Configured" : "None" }
        ]
      }),
      'custom-ftp': (conn) => ({
        ...baseData,
        title: `FTP Connection Created`,
        message: `Your FTP connection has been successfully created and is ready to use.`,
        details: [
          { label: "Hostname", value: conn.config?.hostname || formData.hostname },
          { label: "Port", value: conn.config?.port || formData.port || "21" },
          { label: "Username", value: conn.config?.username || formData.username },
          { label: "Directory", value: conn.config?.directory || formData.directory || "/" },
          { label: "Protocol", value: conn.config?.keyFile || formData.keyFile ? "SFTP" : "FTP" }
        ]
      }),
      'custom-mysql': (conn) => ({
        ...baseData,
        title: `MySQL Connection Created`,
        message: `Your MySQL connection has been successfully created and is ready to use.`,
        details: [
          { label: "Host", value: conn.config?.host || formData.host },
          { label: "Port", value: conn.config?.port || formData.port || "3306" },
          { label: "Username", value: conn.config?.username || formData.username },
          { label: "Database", value: conn.config?.database || formData.database },
          { label: "SSL", value: conn.config?.sslCA || formData.sslCA ? "Enabled" : "Disabled" }
        ]
      })
    };
    const formatter = formatters[type];
    if (formatter) return formatter(connection);
    return {
      ...baseData,
      title: `Connection Created`,
      message: `Your connection has been successfully created and is ready to use.`,
      details: [
        { label: "Type", value: type },
        { label: "Name", value: connection.name }
      ]
    };
  };

  // Navigation
  const navigateToDataManagement = (connectionData) => {
    const originalConnection = connectionData.originalConnection || connectionData;
    
    router.navigate({
      pathname: "/modules/day-book/data-management",
      params: {
        type: connectionType,
        connectionId: originalConnection.id,
        name: originalConnection.name,
        status: originalConnection.status,
        ...originalConnection
      },
    });
  };

  const handleDialogConfirm = () => {
    setShowSuccessDialog(false);
    navigateToDataManagement(connection);
  };

  // UI helpers
  const getTestSectionStatus = () => {
    if (testResponse) return { description: "Connection tested successfully", icon: "wifi-check" };
    if (connectionError) return { description: "Connection test failed", icon: "wifi-alert" };
    return { description: "Test your connection", icon: "wifi-sync" };
  };
  const getFormDescription = () => {
    if (!formData.name) return "Configure your connection";
    const primaryInfo = formData.url || formData.hostname || formData.host || 'connection';
    return `${formData.name} • ${primaryInfo}`;
  };
  const existingConnection = dataSources.find(source => source.type === connectionType);
  const isConnected = () => existingConnection?.status === 'connected';
  const testSectionStatus = getTestSectionStatus();
  const isLoading = isTestingConnection || isCreatingConnection;
  const hasError = adapterError;
  const requiresTest = connectionType === 'custom-api';
  const canCreate = formIsValid && (!requiresTest || testResponse?.status === 'success') && !isLoading;

  return (
    <ResponsiveScreen
      header={<Header title={title} showBack />}
      center={false}
      padded
      scroll={false}
    >
      <ScrollView contentContainerStyle={commonStyles.scrollableContentContainer}>
        <StackLayout spacing={0}>
          {hasError && (
            <View style={{
              padding: 15,
              backgroundColor: theme.colors.errorContainer,
              borderRadius: 8,
              marginBottom: 20
            }}>
              <Text style={{ color: theme.colors.onErrorContainer }}>
                {adapterError}
              </Text>
            </View>
          )}
          <CollapsibleList
            canCloseFormAccordion={formIsValid}
            expandedSections={expandedSections}
            onSectionToggle={handleSectionToggle}
            items={[
              {
                key: "form",
                title: `${title} Configuration`,
                description: getFormDescription(),
                icon: connectionType === 'custom-api' ? 'web' : 'server',
                defaultExpanded: true,
                disabled: false,
                content: (
                  <FormComponent
                    formData={formData}
                    setFormData={setFormData}
                    errors={errors}
                    isConnected={isConnected()}
                    theme={theme}
                    onFieldBlur={generateName}
                  />
                ),
              },
              {
                key: "test",
                title: "Test Connection",
                description: testSectionStatus.description,
                icon: testSectionStatus.icon,
                defaultExpanded: formIsValid && !isConnected(),
                disabled: !formIsValid || isConnected(),
                content: (
                  <TestConnectionSection
                    isTestingConnection={isTestingConnection}
                    testResponse={testResponse}
                    connectionError={connectionError}
                    onTestConnection={handleTestConnection}
                    canTest={formIsValid && adapter}
                    theme={theme}
                  />
                ),
              },
            ]}
          />
        </StackLayout>
      </ScrollView>
      <View style={commonStyles.floatingButtonContainer}>
        <BasicButton
          label={isCreatingConnection ? "Creating Connection..." : "Create Connection"}
          onPress={handleContinue}
          disabled={!canCreate}
          fullWidth={false}
        />
      </View>
      <ConnectionDialog
        visible={showSuccessDialog}
        onDismiss={() => setShowSuccessDialog(false)}
        onConfirm={handleDialogConfirm}
        connection={connection}
      />
    </ResponsiveScreen>
  );
};

export default ConnectionPage;
