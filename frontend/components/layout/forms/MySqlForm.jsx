import React from "react";
import { View, Text } from "react-native";
import StackLayout from "../StackLayout";
import TextField from "../../common/input/TextField";
import { commonStyles } from "../../../assets/styles/stylesheets/common";

const MySqlForm = ({
  formData,
  setFormData,
  errors,
  isConnected,
  theme,
  onFieldBlur,
}) => {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <StackLayout spacing={15}>
        <TextField
          label="Connection Name"
          placeholder="This will be generated for you if left blank"
          value={formData.name || ""}
          onChangeText={(value) => updateField("name", value)}
          error={errors.name}
          disabled={isConnected}
        />

        <TextField
          label="Host"
          placeholder="localhost"
          value={formData.host || ""}
          onChangeText={(value) => updateField("host", value)}
          onBlur={() => {
            if (!formData.name && typeof onFieldBlur === "function") {
              const generated = onFieldBlur();
              if (generated) updateField("name", generated);
            }
          }}
          error={errors.host}
          disabled={isConnected}
          keyboardType="url"
        />

        <TextField
          label="Port"
          placeholder="3306"
          value={formData.port || ""}
          onChangeText={(value) => updateField("port", value)}
          error={errors.port}
          disabled={isConnected}
          keyboardType="numeric"
        />

        <TextField
          label="Username"
          placeholder="Enter username"
          value={formData.username || ""}
          onChangeText={(value) => updateField("username", value)}
          error={errors.username}
          disabled={isConnected}
          autoCapitalize="none"
        />

        <TextField
          label="Password"
          placeholder="Enter password"
          value={formData.password || ""}
          onChangeText={(value) => updateField("password", value)}
          error={errors.password}
          disabled={isConnected}
          secureTextEntry
        />

        <TextField
          label="Database Name"
          placeholder="my_database"
          value={formData.database || ""}
          onChangeText={(value) => updateField("database", value)}
          error={errors.database}
          disabled={isConnected}
        />

        <StackLayout spacing={8}>
          <TextField
            label="SSL CA File (Optional)"
            placeholder="Path to CA certificate"
            value={formData.sslCA || ""}
            onChangeText={(value) => updateField("sslCA", value)}
            error={errors.sslCA}
            disabled={isConnected}
          />
          <Text
            style={[
              commonStyles.captionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Optional: For SSL connections
          </Text>
        </StackLayout>
      </StackLayout>
    </View>
  );
};

export default MySqlForm;
