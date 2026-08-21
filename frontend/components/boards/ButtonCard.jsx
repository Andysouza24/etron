import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import BasicButton from '../common/buttons/BasicButton';
import PermissionGate from '../common/PermissionGate';
import { useHasPermission } from '../../hooks/useHasPermission';
import { getPermissionForRoute } from '../../utils/routePermissions';

const alignmentMap = {
    left: 'flex-start',
    start: 'flex-start',
    center: 'center',
    right: 'flex-end',
    end: 'flex-end',
    stretch: 'stretch'
};

const ButtonCard = ({ item, isEditing, onEdit, disableEditActions = false }) => {
    const theme = useTheme();
    const editIconColor = theme.colors?.primary ?? theme.colors?.icon ?? '#118AB2';
    const editContainerColor = theme.colors?.lowOpacityButton
        ?? theme.colors?.buttonBackground
        ?? theme.colors?.surfaceVariant
        ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)');

    const config = item.config || {};
    const {
        label = 'Button',
        destination,
        width,
        buttonWidth,
        minWidth,
        buttonMinWidth,
        maxWidth,
        buttonMaxWidth,
        alignment,
        align,
        fullWidth,
        buttonProps = {}
    } = config;

    const buttonLabel = label;
    const destinationRoute = typeof destination === 'string'
        ? destination
        : destination?.route ?? null;

    // looks the destination up in the central route permission map. `undefined`
    // means the route is not in the map → treat as denied (default-deny).
    // `null` means explicitly public. otherwise it's the required permission key.
    const requiredPermission = destinationRoute
        ? getPermissionForRoute(destinationRoute)
        : null;
    const isRouteKnown = requiredPermission !== undefined;
    const { allowed: hasRequiredPermission } = useHasPermission(
        isRouteKnown ? requiredPermission : null
    );
    const canNavigate = isRouteKnown && hasRequiredPermission;

    const resolvedWidth = buttonWidth ?? width;
    const resolvedMinWidth = buttonMinWidth ?? minWidth;
    const resolvedMaxWidth = buttonMaxWidth ?? maxWidth;
    const resolvedAlignment = alignmentMap[(alignment ?? align ?? 'center')] ?? 'center';

    const {
        fullWidth: propsFullWidth,
        onPress: _ignoredOnPress,
        label: _ignoredLabel,
        disabled: propsDisabled,
        icon: propsIcon,
        ...restButtonProps
    } = buttonProps;

    const shouldDisableButton = isEditing || Boolean(propsDisabled);
    const shouldFullWidth = typeof propsFullWidth === 'boolean'
        ? propsFullWidth
        : typeof fullWidth === 'boolean'
            ? fullWidth
            : true;

    const buttonIcon = propsIcon ?? config.icon ?? null;

    const wrapperAlignmentStyle = resolvedAlignment === 'stretch'
        ? { alignItems: 'stretch' }
        : { alignItems: resolvedAlignment };

    const widthStyle = {};
    if (resolvedWidth !== undefined) {
        widthStyle.width = resolvedWidth;
    }
    if (resolvedMinWidth !== undefined) {
        widthStyle.minWidth = resolvedMinWidth;
    }
    if (resolvedMaxWidth !== undefined) {
        widthStyle.maxWidth = resolvedMaxWidth;
    }

    const handleButtonPress = () => {
        if (!destinationRoute) return;
        router.push(destinationRoute);
    };

    return (
        <View style={styles.container}>
            {isEditing && !disableEditActions && (
                <View style={styles.editOverlay}>
                    <IconButton
                        icon="pencil"
                        size={18}
                        onPress={() => onEdit?.(item)}
                        style={styles.removeButton}
                        iconColor={editIconColor}
                        containerColor={editContainerColor}
                        accessibilityLabel="Edit board item"
                    />
                </View>
            )}
            <View
                style={[
                    styles.buttonWrapper,
                    wrapperAlignmentStyle,
                    isEditing && styles.editingOpacity
                ]}
            >
                <View
                    style={[
                        shouldFullWidth ? styles.buttonInnerFull : styles.buttonInnerAuto,
                        widthStyle
                    ]}
                >
                    {isEditing ? (
                        <BasicButton
                            label={buttonLabel}
                            onPress={undefined}
                            disabled={shouldDisableButton}
                            fullWidth={shouldFullWidth}
                            icon={buttonIcon}
                            {...restButtonProps}
                        />
                    ) : (
                        <PermissionGate
                            allowed={canNavigate}
                            onAllowed={handleButtonPress}
                        >
                            <BasicButton
                                label={buttonLabel}
                                onPress={handleButtonPress}
                                disabled={shouldDisableButton}
                                fullWidth={shouldFullWidth}
                                icon={buttonIcon}
                                {...restButtonProps}
                            />
                        </PermissionGate>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        padding: 4,
        position: 'relative',
    },
    editOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10,
    },
    removeButton: {
        margin: 0,
        borderRadius: 16,
    },
    buttonWrapper: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editingOpacity: {
        opacity: 0.7,
    },
    buttonInnerFull: {
        width: '100%',
    },
    buttonInnerAuto: {
    },
});

export default ButtonCard;
