import React from "react";
import { View, Text, Pressable } from "react-native";
import StackLayout from "../StackLayout";
import TextField from "../../common/input/TextField";
import { commonStyles } from "../../../assets/styles/stylesheets/common";

const JSON_HEADERS_EXAMPLE = `{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_TOKEN",
  "X-API-Key": "your-api-key"
}`;

const ApiForm = ({
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
          label="API Name"
          placeholder="This will be generated for you if left blank"
          value={formData.name || ""}
          onChangeText={(value) => updateField("name", value)}
          error={errors.name}
          disabled={isConnected}
        />

        <TextField
          label="API URL"
          placeholder="https://api.example.com/v1"
          value={formData.url || ""}
          onChangeText={(value) => updateField("url", value)}
          onBlur={() => {
            if (!formData.name && typeof onFieldBlur === "function") {
              const generated = onFieldBlur();
              if (generated) updateField("name", generated);
            }
          }}
          error={errors.url}
          disabled={isConnected}
          keyboardType="url"
        />

        <StackLayout spacing={8}>
          <TextField
            label="Headers (JSON format)"
            placeholder={JSON_HEADERS_EXAMPLE}
            value={formData.headers || ""}
            onChangeText={(value) => updateField("headers", value)}
            error={errors.headers}
            disabled={isConnected}
            tall={true}
            dense={true}
          />
          <Text
            style={[
              commonStyles.captionText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Optional: Add custom headers in JSON format
          </Text>
        </StackLayout>

        {/* Authentication selection */}
        <View style={{ marginTop: 4 }}>
          <Text style={[commonStyles.captionText, { color: theme.colors.onSurfaceVariant, marginBottom: 8 }]}>Authentication (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { key: 'none', label: 'None' },
              { key: 'apiKey', label: 'API Key' },
              { key: 'bearer', label: 'Bearer' },
              { key: 'jwt', label: 'JWT Bearer' },
              { key: 'basic', label: 'Basic' },
            ].map(opt => {
              const selected = (formData.authType || 'none') === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => !isConnected && updateField('authType', opt.key)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: selected ? theme.colors.primaryContainer : 'transparent',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Authentication details based on selection */}
        {formData.authType === 'apiKey' && (
          <StackLayout spacing={12}>
            <TextField
              label="API Key"
              placeholder="your-api-key"
              value={formData.apiKey || ""}
              onChangeText={(v) => updateField('apiKey', v)}
              disabled={isConnected}
              secureTextEntry
            />
            <TextField
              label="Header Name (optional)"
              placeholder="e.g. X-API-Key"
              value={formData.apiKeyHeader || ""}
              onChangeText={(v) => updateField('apiKeyHeader', v)}
              disabled={isConnected}
            />
          </StackLayout>
        )}

        {(formData.authType === 'bearer' || formData.authType === 'jwt') && (
          <StackLayout spacing={12}>
            <TextField
              label={formData.authType === 'jwt' ? 'JWT Token' : 'Bearer Token'}
              placeholder="your-token"
              value={formData.token || ""}
              onChangeText={(v) => updateField('token', v)}
              disabled={isConnected}
              secureTextEntry
            />
          </StackLayout>
        )}

        {formData.authType === 'basic' && (
          <StackLayout spacing={12}>
            <TextField
              label="Username"
              placeholder="Enter username"
              value={formData.username || ""}
              onChangeText={(v) => updateField('username', v)}
              disabled={isConnected}
              autoCapitalize="none"
            />
            <TextField
              label="Password"
              placeholder="Enter password"
              value={formData.password || ""}
              onChangeText={(v) => updateField('password', v)}
              disabled={isConnected}
              secureTextEntry
            />
          </StackLayout>
        )}
      </StackLayout>
    </View>
  );
};

export default ApiForm;
