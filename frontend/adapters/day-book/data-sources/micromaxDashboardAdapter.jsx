// frontend adapter for the "micromax-dashboard" connection type
// no config and no secrets

import React, { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { HelperText, Text, useTheme } from "react-native-paper";
import { router } from "expo-router";

import ResponsiveScreen from "../../../components/layout/ResponsiveScreen";
import Header from "../../../components/layout/Header";
import StackLayout from "../../../components/layout/StackLayout";
import TextField from "../../../components/common/input/TextField";
import BasicButton from "../../../components/common/buttons/BasicButton";
import ConnectionDialog from "../../../components/overlays/ConnectionDialog";
import { commonStyles } from "../../../assets/styles/stylesheets/common";
import { useDataSourceContext } from "../../../contexts/DataSourceContext";
import {
  validateMicromaxDashboardForm,
  buildMicromaxDashboardConnectionData,
} from "../../../utils/connectionValidators";

const SOURCE_TYPE = "micromax-dashboard";
const EXPORT_PREFIX = "exports/";
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.json$/;

const buildObjectKey = (fileName) => {
  if (!fileName || !FILE_NAME_PATTERN.test(fileName)) {
    throw new Error("fileName must match /^[A-Za-z0-9._-]+\\.json$/");
  }
  return `${EXPORT_PREFIX}${fileName}`;
};

const parseObjectKey = (key) => {
  if (!key || !key.startsWith(EXPORT_PREFIX)) return null;
  const fileName = key.slice(EXPORT_PREFIX.length);
  if (!fileName || fileName.includes("/")) return null;
  if (!FILE_NAME_PATTERN.test(fileName)) return null;
  return { fileName };
};

export const createMicromaxDashboardAdapter = (
  authService,
  apiClient,
  options = {}
) => {
  let currentConnection = null;
  let isConnected = false;

  const connect = async (connectionData = {}) => {
    const newConnection = {
      id: `micromax-dashboard_${Date.now()}`,
      name: connectionData.name || "Micromax Dashboard",
      status: "connected",
      createdAt: new Date().toISOString(),
    };
    currentConnection = newConnection;
    isConnected = true;
    return { connected: true, connection: currentConnection };
  };

  const disconnect = async () => {
    currentConnection = null;
    isConnected = false;
    return { connected: true };
  };

  // The parent connection has no endpoint to ping; the backend manages the
  // ingest pipeline. Return a success result so that flows that rely on a
  // local test still resolve.
  const testConnection = async () => ({
    status: "success",
    sampleData: {
      message:
        "Micromax Dashboard connection has no local endpoint. Files are imported automatically.",
      timestamp: new Date().toISOString(),
    },
  });

  // Child file data sources are created by the backend ingest pipeline. The
  // parent never exposes its own data sources from the frontend.
  const getDataSources = async () => {
    if (!isConnected) {
      throw new Error("Not connected to Micromax Dashboard");
    }
    return [];
  };

  // The parent never holds row data. Direct fetches should go through the
  // child `micromax-dashboard-file` adapter or the backend `viewData`
  // endpoint.
  const fetchRawData = async () => {
    throw new Error(
      "Micromax Dashboard parent connection holds no data; fetch from a child file data source instead."
    );
  };

  return {
    type: SOURCE_TYPE,
    connect,
    disconnect,
    testConnection,
    getDataSources,
    fetchRawData,
    getCurrentConnection: () => currentConnection,
    isConnected: () => isConnected,
    // Expose helpers so other modules can build/parse object keys consistently.
    EXPORT_PREFIX,
    FILE_NAME_PATTERN,
    buildObjectKey,
    parseObjectKey,
  };
};

const MICROMAX_TITLE = "Micromax Dashboard";

export const MicromaxDashboardConnectionScreen = () => {
  const theme = useTheme();
  const { connectDataSource } = useDataSourceContext();

  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdConnection, setCreatedConnection] = useState(null);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formIsValid = useMemo(
    () => validateMicromaxDashboardForm(formData),
    [formData]
  );

  const handleCreate = async () => {
    const validation = validateMicromaxDashboardForm(formData, true);
    if (validation !== true) {
      setErrors(validation);
      return;
    }
    setErrors({});
    setIsCreating(true);
    try {
      const connectionData = buildMicromaxDashboardConnectionData(formData);
      const result = await connectDataSource(
        SOURCE_TYPE,
        connectionData,
        connectionData.name
      );
      if (!result || !result.id) {
        throw new Error("Backend did not confirm creation");
      }
      setCreatedConnection({
        title: "Micromax Dashboard Connected",
        message:
          "Your existing exports are being imported. New ones will appear automatically.",
        name: result.name,
        status: result.status || "connected",
        createdAt: result.createdAt || new Date().toISOString(),
        isDemoMode: false,
        originalConnection: result,
      });
      setShowSuccessDialog(true);
    } catch (err) {
      console.error("[MicromaxDashboardConnectionScreen] create error:", err);
      Alert.alert("Error", err?.message || "Failed to create connection");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDialogConfirm = () => {
    setShowSuccessDialog(false);
    const original =
      createdConnection?.originalConnection || createdConnection;
    router.navigate({
      pathname: "/modules/day-book/data-management",
      params: {
        type: SOURCE_TYPE,
        connectionId: original?.id,
        name: original?.name,
        status: original?.status,
      },
    });
  };

  return (
    <ResponsiveScreen
      header={<Header title={MICROMAX_TITLE} showBack />}
      center={false}
      padded
      scroll={false}
    >
      <ScrollView contentContainerStyle={commonStyles.scrollableContentContainer}>
        <StackLayout spacing={20}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Connect Micromax Dashboard. Each export file is added as its own
            data source automatically. Files update when re-uploaded and
            disappear when removed.
          </Text>

          <TextField
            label="Connection name (optional)"
            placeholder="e.g. Micromax Dashboard"
            value={formData.name || ""}
            onChangeText={(value) => updateField("name", value)}
            error={!!errors.name}
          />
          <HelperText type="error" visible={!!errors.name}>
            {errors.name}
          </HelperText>
        </StackLayout>
      </ScrollView>

      <View style={commonStyles.floatingButtonContainer}>
        <BasicButton
          label="Connect"
          onPress={handleCreate}
          disabled={!formIsValid || isCreating}
          loading={isCreating}
          fullWidth={false}
        />
      </View>

      <ConnectionDialog
        visible={showSuccessDialog}
        onDismiss={() => setShowSuccessDialog(false)}
        onConfirm={handleDialogConfirm}
        connection={createdConnection}
      />
    </ResponsiveScreen>
  );
};

export {
  SOURCE_TYPE,
  EXPORT_PREFIX,
  FILE_NAME_PATTERN,
  buildObjectKey,
  parseObjectKey,
};

export const adapterDescriptor = {
  type: SOURCE_TYPE,
  category: "micromax-dashboard",
  factory: createMicromaxDashboardAdapter,
  ConnectionScreen: MicromaxDashboardConnectionScreen,
};
