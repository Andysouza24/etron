import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';

const textAlignMap = {
    center: 'center',
    right: 'right',
    justify: 'justify'
};

const TextCard = ({
    item,
    isEditing,
    onEdit,
    disableEditActions = false
}) => {
    const theme = useTheme();
    const config = item?.config ?? {};

    const editIconColor = theme.colors?.primary ?? theme.colors?.icon ?? '#118AB2';
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)');

    const contentText = typeof config.text === 'string' ? config.text.trim() : '';
    const isEmpty = contentText.length === 0;

    const alignment = textAlignMap[config.alignment] ?? 'left';
    const fontSize = Number.isFinite(config.fontSize) ? config.fontSize : parseFloat(config.fontSize);
    const resolvedFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18;
    const lineHeightInput = Number.isFinite(config.lineHeight) ? config.lineHeight : parseFloat(config.lineHeight);
    const resolvedLineHeight = Number.isFinite(lineHeightInput) && lineHeightInput > 0
        ? lineHeightInput
        : Math.round(resolvedFontSize * 1.3);
    const padding = Number.isFinite(config.padding) ? config.padding : parseFloat(config.padding);
    const resolvedPadding = Number.isFinite(padding) && padding >= 0 ? padding : 16;

    const textColorValue = typeof config.textColor === 'string' && config.textColor.trim().length
        ? config.textColor.trim()
        : theme.colors?.onSurface ?? theme.colors?.text ?? '#1B1B1B';

    const placeholderColor = theme.colors?.onSurfaceVariant
        ?? theme.colors?.outline
        ?? 'rgba(0,0,0,0.45)';

    const backgroundColorValue = typeof config.backgroundColor === 'string' && config.backgroundColor.trim().length
        ? config.backgroundColor.trim()
        : 'transparent';

    const borderColorValue = typeof config.borderColor === 'string' && config.borderColor.trim().length
        ? config.borderColor.trim()
        : 'transparent';
    const shouldShowBorder = borderColorValue !== 'transparent';

    const maxLines = Number.isFinite(config.maxLines) ? config.maxLines : parseInt(config.maxLines, 10);
    const resolvedMaxLines = Number.isFinite(maxLines) && maxLines > 0 ? maxLines : undefined;

    return (
        <View style={styles.wrapper}>
            {isEditing && !disableEditActions && (
                <View style={styles.editOverlay}>
                    <IconButton
                        icon="pencil"
                        size={18}
                        onPress={() => onEdit?.(item)}
                        style={styles.editButton}
                        iconColor={editIconColor}
                        containerColor={editContainerColor}
                        accessibilityLabel="Edit text block"
                    />
                </View>
            )}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: backgroundColorValue,
                        borderColor: borderColorValue,
                        borderWidth: shouldShowBorder ? StyleSheet.hairlineWidth : 0,
                        padding: resolvedPadding
                    },
                    isEditing && styles.editingOpacity
                ]}
            >
                <Text
                    style={{
                        fontSize: resolvedFontSize,
                        lineHeight: resolvedLineHeight,
                        textAlign: alignment,
                        color: isEmpty ? placeholderColor : textColorValue
                    }}
                    numberOfLines={resolvedMaxLines}
                >
                    {isEmpty ? 'Tap edit to add text' : contentText}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative'
    },
    card: {
        flex: 1,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center'
    },
    editOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10
    },
    editButton: {
        margin: 0,
        borderRadius: 16
    },
    editingOpacity: {
        opacity: 0.8
    }
});

export default TextCard;
