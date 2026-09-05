import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { commonStyles } from '../../assets/styles/stylesheets/common';
import Divider from '../layout/Divider';

const TestResultCard = ({
    result,
    error,
    title = "Test Results"
}) => {
    const theme = useTheme();

    const { isError, isSuccess } = useMemo(() => ({
        isError: !!error,
        isSuccess: result?.status === 'success'
    }), [result, error]);

    const borderColor = useMemo(() => (
        isError ? theme.colors.error :
        isSuccess ? theme.colors.themeGreen :
        theme.colors.secondary
    ), [isError, isSuccess, theme.colors]);

    if (!result && !error) return null;

    const statusColor = isSuccess ? theme.colors.themeGreen : theme.colors.error;

    const formatValue = (value) => {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return '[Object]';
            }
        }
        return String(value);
    };

    const shouldDisplayAsJson = (value) => {
        return typeof value === 'object' && value !== null;
    };

    const formatFieldName = (key) => {
        return key
            .split(/(?=[A-Z])|_|-/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ') + ':';
    };

    const renderRow = (label, value, valueStyle) => (
        <View style={styles.row}>
            <Text style={commonStyles.bodyText}>{label}</Text>
            <Text style={[commonStyles.captionText, styles.valueRight, valueStyle]}>
                {value}
            </Text>
        </View>
    );

    const renderJsonBlock = (label, value) => (
        <View style={styles.sampleRow}>
            <Text style={commonStyles.bodyText}>{label}</Text>
            <Text style={[
                styles.jsonBlock,
                {
                    backgroundColor: theme.colors.buttonBackground,
                    color: theme.colors.themeGrey
                }
            ]}>
                {formatValue(value)}
            </Text>
        </View>
    );

    const renderResultData = () => {
        if (!result || typeof result !== 'object') return null;

        const entries = Object.entries(result);
        const rows = [];
        const jsonBlocks = [];

        entries.forEach(([key, value]) => {
            if (value === null || value === undefined) return;
            
            const formattedLabel = formatFieldName(key);
            
            if (shouldDisplayAsJson(value)) {
                jsonBlocks.push({ label: formattedLabel, value });
            } else {
                const valueStyle = key === 'status' ? { color: statusColor } : {};
                rows.push(
                    <View key={key}>
                        {renderRow(formattedLabel, formatValue(value), valueStyle)}
                    </View>
                );
            }
        });

        return (
            <>
                {rows}
                {rows.length > 0 && jsonBlocks.length > 0 && (
                    <Divider color={theme.colors.buttonBackground} />
                )}
                {jsonBlocks.map(({ label, value }, index) => (
                    <View key={`json-${index}`}>
                        {renderJsonBlock(label, value)}
                    </View>
                ))}
            </>
        );
    };

    return (
        <Card style={[styles.card, { borderColor, backgroundColor: theme.colors.background }]}>
            <View style={styles.titleContainer}>
                <Text style={[commonStyles.titleText, styles.title, { color: borderColor }]}>
                    {title}
                </Text>
                <Divider color={theme.colors.buttonBackground} />
            </View>
            <Card.Content>
                <View style={styles.contentWrapper}>
                    {isError ? (
                        renderRow('Error:', formatValue(error), { color: theme.colors.error })
                    ) : (
                        renderResultData()
                    )}
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        marginTop: 20,
        borderWidth: 2,
        borderRadius: 12,
        elevation: 2,
    },
    titleContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    title: {
        textAlign: 'center',
        fontSize: 18,
        paddingBottom: 10,
    },
    contentWrapper: {
        marginTop: 4,
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    valueRight: {
        flex: 1,
        textAlign: 'right',
    },
    sampleRow: {
        marginTop: 10,
    },
    jsonBlock: {
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 18,
        padding: 8,
        borderRadius: 4,
        marginTop: 4,
    }
});

export default TestResultCard;