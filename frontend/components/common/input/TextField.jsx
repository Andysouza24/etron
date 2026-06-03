// Author(s): Rhys Cleary, Holly Wyatt

import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TextInput, useTheme } from "react-native-paper";

const TextField = ({
    label,
    value,
    placeholder,
    error,
    onChangeText,
    secureTextEntry = false,
    tall = false,
    dense = false,
    onFocus,
    onBlur,
    autoCapitalize = 'none',
    contentStyle,
    isDisabled = false,
    customRightButton = false,
    rightButtonIcon,
    rightButtonPress,
    noStyle = false,
}) => {
    const theme = useTheme();
    const [hidePassword, setHidePassword] = useState(secureTextEntry);
    const [focused, setFocused] = useState(false);
    const isPassword = secureTextEntry === true;

    const getInputStyle = () => {
        if (!tall) return undefined;

        const baseStyle = focused ? styles.tallInputFocused : styles.tallInputClipped;

        return [
            baseStyle,
            dense && { paddingVertical: 18 }
        ];
    };

    return (
        <View style={styles.componentContainer}>
            {label ? (
                <View
                    style={[
                        styles.labelContainer,
                        { backgroundColor: noStyle ? theme.colors.surface : theme.colors.background },
                    ]}
                >
                    <Text style={[styles.label, { color: theme.colors.text }]}>
                        {label}
                    </Text>
                </View>
            ) : null}

            <TextInput
                mode="outlined"
                disabled={isDisabled}
                dense={dense}
                autoCapitalize={autoCapitalize}
                value={value}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.themeGrey}
                {...(error === true ? { error: true } : {})}
                onChangeText={onChangeText}
                outlineStyle={{
                    borderWidth: 1,
                    borderColor: theme.colors.secondary,
                }}
                onFocus={(e) => {
                    setFocused(true)
                    if (onFocus) onFocus(e);
                }}
                onBlur={(e) => {
                    setFocused(false)
                    if (onBlur) onBlur(e)
                }}
                multiline={tall}
                numberOfLines={tall ? 8 : 1}
                scrollEnabled={focused}
                style={getInputStyle()}
                contentStyle={contentStyle}
                secureTextEntry={isPassword ? hidePassword : false}
                right={
                    customRightButton ? (
                        <TextInput.Icon
                            icon={rightButtonIcon}
                            onPress={rightButtonPress}
                        />
                    ) : (
                        isPassword ? (
                            <TextInput.Icon
                                icon={hidePassword ? "eye-off" : "eye"}
                                onPress={() => setHidePassword(!hidePassword)}
                            />
                        ) : null
                    )
                }
            />
            {typeof error === "string" && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    componentContainer: {
        position: 'relative'
    },
    labelContainer: {
        position: 'absolute',
        top: -10,
        left: 12,
        zIndex: 1
    },
    label: {
        fontSize: 14
    },
    tallInputFocused: {
        minHeight: 64,
        textAlignVertical: 'top',
        paddingVertical: 24,
    },
    tallInputClipped: {
        minHeight: 64,
        maxHeight: 150,
        textAlignVertical: 'top',
        paddingVertical: 24,
    },
    errorText: {
        marginTop: 4,
        fontSize: 12,
    }
});

export default TextField;