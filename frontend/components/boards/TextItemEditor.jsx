import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, useTheme } from 'react-native-paper';
import { sanitizeColourValue } from '../../utils/boards/boardUtils';

const alignmentButtons = [
    { value: 'left', label: 'Left', icon: 'format-align-left' },
    { value: 'center', label: 'Center', icon: 'format-align-center' },
    { value: 'right', label: 'Right', icon: 'format-align-right' }
];

const TextItemEditor = ({
    initialConfig = {},
    mode = 'create',
    onSave,
    onCancel
}) => {
    const theme = useTheme();
    const [textValue, setTextValue] = useState(initialConfig.text ?? '');
    const [alignment, setAlignment] = useState(initialConfig.alignment ?? 'left');
    const [fontSize, setFontSize] = useState(
        initialConfig.fontSize !== undefined ? String(initialConfig.fontSize) : '18'
    );
    const [padding, setPadding] = useState(
        initialConfig.padding !== undefined ? String(initialConfig.padding) : '16'
    );
    const [textColor, setTextColor] = useState(initialConfig.textColor ?? '');
    const [backgroundColor, setBackgroundColor] = useState(initialConfig.backgroundColor ?? '');
    const [maxLines, setMaxLines] = useState(
        initialConfig.maxLines !== undefined ? String(initialConfig.maxLines) : ''
    );

    const [textError, setTextError] = useState('');
    const [textColorError, setTextColorError] = useState('');
    const [backgroundColorError, setBackgroundColorError] = useState('');

    const previewStyles = useMemo(() => {
        const numericFontSize = Number.parseFloat(fontSize);
        const resolvedFontSize = Number.isFinite(numericFontSize) && numericFontSize > 0
            ? numericFontSize
            : 18;
        const numericPadding = Number.parseFloat(padding);
        const resolvedPadding = Number.isFinite(numericPadding) && numericPadding >= 0
            ? numericPadding
            : 16;
        return {
            fontSize: resolvedFontSize,
            padding: resolvedPadding
        };
    }, [fontSize, padding]);

    const resetErrors = () => {
        setTextError('');
        setTextColorError('');
        setBackgroundColorError('');
    };

    const handleSave = async () => {
        resetErrors();
        const trimmedText = textValue.trim();

        if (!trimmedText) {
            setTextError('Text is required');
            return;
        }

        const parsedFontSize = Number.parseFloat(fontSize);
        const resolvedFontSize = Number.isFinite(parsedFontSize) && parsedFontSize > 0
            ? parsedFontSize
            : 18;

        const parsedPadding = Number.parseFloat(padding);
        const resolvedPadding = Number.isFinite(parsedPadding) && parsedPadding >= 0
            ? parsedPadding
            : 16;

        const parsedMaxLines = Number.parseInt(maxLines, 10);
        const resolvedMaxLines = Number.isFinite(parsedMaxLines) && parsedMaxLines > 0
            ? parsedMaxLines
            : undefined;

        let resolvedTextColor = '';
        if (textColor.trim()) {
            const sanitised = sanitizeColourValue(textColor.trim());
            if (!sanitised) {
                setTextColorError('Enter a valid hex colour (e.g. #118AB2)');
                return;
            }
            resolvedTextColor = sanitised;
        }

        let resolvedBackgroundColor = '';
        if (backgroundColor.trim()) {
            const sanitised = sanitizeColourValue(backgroundColor.trim());
            if (!sanitised) {
                setBackgroundColorError('Enter a valid hex colour (e.g. #0F1622)');
                return;
            }
            resolvedBackgroundColor = sanitised;
        }

        if (onSave) {
            await onSave({
                text: trimmedText,
                alignment,
                fontSize: resolvedFontSize,
                padding: resolvedPadding,
                textColor: resolvedTextColor,
                backgroundColor: resolvedBackgroundColor,
                maxLines: resolvedMaxLines
            });
        }
    };

    const actionLabel = mode === 'edit' ? 'Save Changes' : 'Add Text Block';

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                <View style={styles.actions}>
                    <Button mode="text" onPress={onCancel}>
                        Cancel
                    </Button>
                    <Button mode="contained" onPress={handleSave}>
                        {actionLabel}
                    </Button>
            </View>
                <TextInput
                    label="Text"
                    value={textValue}
                    onChangeText={(value) => {
                        setTextValue(value);
                        if (value.trim()) setTextError('');
                    }}
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    style={styles.input}
                    error={Boolean(textError)}
                    placeholder="Add your content"
                />
                {textError ? (
                    <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors?.error ?? '#ff5252' }]}>
                        {textError}
                    </Text>
                ) : null}
            </View>

            <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                    Alignment
                </Text>
                <SegmentedButtons
                    value={alignment}
                    onValueChange={setAlignment}
                    buttons={alignmentButtons}
                    style={styles.segmentedButtons}
                />
            </View>

            <View style={styles.row}>
                <TextInput
                    label="Font Size"
                    value={fontSize}
                    onChangeText={setFontSize}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.rowInput]}
                />
                <TextInput
                    label="Padding"
                    value={padding}
                    onChangeText={setPadding}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.rowInput]}
                />
            </View>

            <View style={styles.row}>
                <TextInput
                    label="Text Colour"
                    value={textColor}
                    onChangeText={(value) => {
                        setTextColor(value);
                        if (!value.trim()) setTextColorError('');
                    }}
                    mode="outlined"
                    placeholder="#118AB2"
                    style={[styles.input, styles.rowInput]}
                    error={Boolean(textColorError)}
                />
                <TextInput
                    label="Background Colour"
                    value={backgroundColor}
                    onChangeText={(value) => {
                        setBackgroundColor(value);
                        if (!value.trim()) setBackgroundColorError('');
                    }}
                    mode="outlined"
                    placeholder="#0F1622"
                    style={[styles.input, styles.rowInput]}
                    error={Boolean(backgroundColorError)}
                />
            </View>
            {textColorError ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors?.error ?? '#ff5252' }]}>
                    {textColorError}
                </Text>
            ) : null}
            {backgroundColorError ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors?.error ?? '#ff5252' }]}>
                    {backgroundColorError}
                </Text>
            ) : null}

            <View style={styles.section}>
                <TextInput
                    label="Max Lines (optional)"
                    value={maxLines}
                    onChangeText={setMaxLines}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="Leave empty for unlimited"
                />
            </View>

            <View
                style={[
                    styles.preview,
                    {
                        backgroundColor: backgroundColor.trim() ? backgroundColor : theme.colors?.surfaceVariant ?? theme.colors?.surface ?? '#f6f6f6',
                        borderColor: theme.colors?.outline ?? 'rgba(0,0,0,0.12)'
                    }
                ]}
            >
                <Text
                    style={{
                        fontSize: previewStyles.fontSize,
                        lineHeight: Math.round(previewStyles.fontSize * 1.3),
                        padding: previewStyles.padding,
                        textAlign: alignment,
                        color: textColor.trim() ? textColor : theme.colors?.onSurface ?? '#1B1B1B'
                    }}
                >
                    {textValue.trim() || 'Preview text will appear here'}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 16
    },
    section: {
        marginBottom: 16
    },
    sectionTitle: {
        marginBottom: 12,
        fontWeight: '600'
    },
    input: {
        marginBottom: 8
    },
    row: {
        flexDirection: 'row',
        gap: 12
    },
    rowInput: {
        flex: 1
    },
    errorText: {
        marginTop: -4,
        marginBottom: 8
    },
    segmentedButtons: {
        marginTop: 4
    },
    preview: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        marginBottom: 24
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    }
});

export default TextItemEditor;
