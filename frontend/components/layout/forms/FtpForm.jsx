import React from "react";
import { View, Text } from "react-native";
import StackLayout from "../StackLayout";
import TextField from "../../common/input/TextField";
import { commonStyles } from "../../../assets/styles/stylesheets/common";

const FtpForm = ({
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
          label="Hostname"
          placeholder="ftp.example.com"
          value={formData.hostname || ""}
          onChangeText={(value) => updateField("hostname", value)}
          onBlur={() => {
            if (!formData.name && typeof onFieldBlur === "function") {
              const generated = onFieldBlur();
              if (generated) updateField("name", generated);
            }
          }}
          error={errors.hostname}
          disabled={isConnected}
          keyboardType="url"
        />

        <TextField
          label="Port"
          placeholder="21"
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

        <StackLayout spacing={8}>
          <TextField
            label="Key File (Optional)"
            placeholder="Path to private key file"
            value={formData.keyFile || ""}
            onChangeText={(value) => updateField("keyFile", value)}
            error={errors.keyFile}
            disabled={isConnected}
          />
          <Text
            style={[
              commonStyles.captionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Optional: For key-based authentication
          </Text>
        </StackLayout>

        <StackLayout spacing={8}>
          <TextField
            label="Directory"
            placeholder="/home/user/data"
            value={formData.directory || ""}
            onChangeText={(value) => updateField("directory", value)}
            error={errors.directory}
            disabled={isConnected}
          />
          <Text
            style={[
              commonStyles.captionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Optional: Default directory path
          </Text>
        </StackLayout>
      </StackLayout>
    </View>
  );
};

export default FtpForm;
