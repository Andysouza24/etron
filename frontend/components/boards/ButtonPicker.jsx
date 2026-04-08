import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Button, TextInput, Text, useTheme, IconButton as PaperIconButton } from 'react-native-paper';
import DescriptiveButton from '../common/buttons/DescriptiveButton';
import IconButton from '../common/buttons/IconButton';

const NAVIGATION_DESTINATIONS = [
    {
        id: 'reports',
        label: 'Reports',
        icon: 'file-chart',
        route: '/(auth)/(drawer)/modules/day-book/reports'
    },
    {
        id: 'data-management',
        label: 'Data Management',
        icon: 'database-cog',
        route: '/(auth)/(drawer)/modules/day-book/data-management'
    },
    {
        id: 'metrics',
        label: 'Metrics',
        icon: 'chart-line',
        route: '/(auth)/(drawer)/modules/day-book/metrics'
    },
    {
        id: 'boards',
        label: 'Boards',
        icon: 'grid-large',
        route: '/(auth)/(drawer)/boards'
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'view-dashboard',
        route: '/(auth)/(drawer)/dashboard'
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: 'cog',
        route: '/(auth)/(drawer)/settings'
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: 'account-circle',
        route: '/(auth)/(tabs)/profile'
    }
];

const ICON_CHOICES = [
    { id: 'file-chart', label: 'Reports', icon: 'file-chart' },
    { id: 'database-cog', label: 'Data', icon: 'database-cog' },
    { id: 'chart-line', label: 'Metrics', icon: 'chart-line' },
    { id: 'grid-large', label: 'Boards', icon: 'grid-large' },
    { id: 'view-dashboard', label: 'Dashboard', icon: 'view-dashboard' },
    { id: 'cog', label: 'Settings', icon: 'cog' },
    { id: 'account-circle', label: 'Profile', icon: 'account-circle' },
    { id: 'bell-outline', label: 'Alerts', icon: 'bell-outline' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'clipboard-text', label: 'Tasks', icon: 'clipboard-text' },
    { id: 'finance', label: 'Finance', icon: 'finance' },
    { id: 'rocket-launch', label: 'Launch', icon: 'rocket-launch' },
    { id: 'tag-multiple', label: 'Tags', icon: 'tag-multiple' },
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'chart-bubble', label: 'Insights', icon: 'chart-bubble' },
    { id: 'chart-bar', label: 'Performance', icon: 'chart-bar' },
    { id: 'lightbulb-on', label: 'Ideas', icon: 'lightbulb-on' },
    { id: 'file-upload', label: 'Uploads', icon: 'file-upload' },
    { id: 'account-group', label: 'Team', icon: 'account-group' },
    { id: 'database', label: 'Database', icon: 'database' }
];

const findDestinationMatch = (destinationValue) => {
    if (!destinationValue) return null;

    if (typeof destinationValue === 'string') {
        const matchedByRoute = NAVIGATION_DESTINATIONS.find((option) => option.route === destinationValue);
        if (matchedByRoute) return matchedByRoute;
        return NAVIGATION_DESTINATIONS.find((option) => option.id === destinationValue) ?? null;
    }

    if (typeof destinationValue === 'object') {
        const { route, id } = destinationValue;
        if (route) {
            const matchedByRoute = NAVIGATION_DESTINATIONS.find((option) => option.route === route);
            if (matchedByRoute) return matchedByRoute;
        }
        if (id) {
            const matchedById = NAVIGATION_DESTINATIONS.find((option) => option.id === id);
            if (matchedById) return matchedById;
        }
        return destinationValue;
    }

    return null;
};

const resolveInitialIconId = (config, destinationMatch) => {
    const iconCandidates = [
        config?.icon,
        config?.buttonProps?.icon,
        destinationMatch?.icon
    ].filter(Boolean);

    for (const candidate of iconCandidates) {
        const choice = ICON_CHOICES.find((option) => option.icon === candidate || option.id === candidate);
        if (choice) {
            return choice.id;
        }
    }

    return ICON_CHOICES[0].id;
};

const ButtonPicker = ({ onSelect, onCancel, initialConfig = {}, mode = 'create' }) => {
    const theme = useTheme();
    const initialDestination = useMemo(
        () => findDestinationMatch(initialConfig?.destination),
        [initialConfig]
    );
    const initialLabel = useMemo(
        () => initialConfig?.label ?? initialDestination?.label ?? '',
        [initialConfig, initialDestination]
    );
    const initialIconId = useMemo(
        () => resolveInitialIconId(initialConfig, initialDestination),
        [initialConfig, initialDestination]
    );
    const [buttonLabel, setButtonLabel] = useState(initialLabel);
    const [selectedDestination, setSelectedDestination] = useState(initialDestination);
    const defaultButtonColor = theme.colors?.primary ?? '#2979FF';
    const buttonColor = useMemo(
        () => initialConfig?.color ?? defaultButtonColor,
        [initialConfig, defaultButtonColor]
    );
    const [selectedIconId, setSelectedIconId] = useState(initialIconId);
    const [labelError, setLabelError] = useState(false);
    const [activePage, setActivePage] = useState('details');

    const selectedIconOption = useMemo(
        () => ICON_CHOICES.find(option => option.id === selectedIconId) ?? ICON_CHOICES[0],
        [selectedIconId]
    );
    const selectedIcon = selectedIconOption.icon;

    useEffect(() => {
        setButtonLabel(initialLabel);
        setSelectedDestination(initialDestination);
        setSelectedIconId(initialIconId);
        setLabelError(false);
        setActivePage('details');
    }, [initialLabel, initialDestination, initialIconId, mode]);

    const handleDestinationSelect = (destination) => {
        setSelectedDestination(destination);
        if (!buttonLabel.trim()) {
            setButtonLabel(destination.label);
        }
        if (destination.icon) {
            const matchedIcon = ICON_CHOICES.find((option) => option.icon === destination.icon || option.id === destination.icon);
            if (matchedIcon) {
                setSelectedIconId(matchedIcon.id);
            }
        }
    };

    const handleIconSelect = (iconOption) => {
        setSelectedIconId(iconOption.id);
        setActivePage('details');
    };

    const handleConfirm = () => {
        const trimmedLabel = buttonLabel.trim();
        
        if (!trimmedLabel) {
            setLabelError(true);
            return;
        }

        if (!selectedDestination) {
            return;
        }

        const buttonConfig = {
            label: trimmedLabel,
            destination: selectedDestination,
            color: buttonColor,
            icon: selectedIcon
        };

        onSelect(buttonConfig);
    };

    const isValid = buttonLabel.trim() && selectedDestination;

    const renderDestinationButtons = () => (
        <View style={styles.destinationsWrap}>
            {NAVIGATION_DESTINATIONS.map((destination) => {
                const isSelected = selectedDestination?.id === destination.id;
                return (
                    <View key={destination.id} style={styles.descriptiveButtonWrapper}>
                        <DescriptiveButton
                            icon={destination.icon}
                            label={destination.label}
                            onPress={() => handleDestinationSelect(destination)}
                            focused={isSelected}
                            showChevron={false}
                            noBorder
                            boldLabel={false}
                            fullWidth={false}
                            iconColor={isSelected ? theme.colors?.onPrimary ?? '#ffffff' : undefined}
                        />
                    </View>
                );
            })}
        </View>
    );

    const renderDetailsPage = () => (
        <View style={styles.container}>
            <View style={styles.section}>
                <TextInput
                    label="Button Label"
                    value={buttonLabel}
                    onChangeText={(text) => {
                        setButtonLabel(text);
                        if (text.trim()) setLabelError(false);
                    }}
                    style={styles.input}
                    mode="outlined"
                    error={labelError}
                    placeholder="e.g., Go to Metrics"
                    dense
                />
                {labelError && (
                    <Text
                        variant="bodySmall"
                        style={[styles.errorText, { color: theme.colors?.error ?? '#ff5252' }]}
                    >
                        Button label is required
                    </Text>
                )}
            </View>
            <View style={styles.actions}>
                <Button
                    mode="text"
                    onPress={onCancel}
                    style={styles.actionButton}
                >
                    Cancel
                </Button>
                <Button
                    mode="contained"
                    onPress={handleConfirm}
                    disabled={!isValid}
                    style={styles.actionButton}
                >
                    {mode === 'edit' ? 'Save Button' : 'Add Button'}
                </Button>
            </View>

            <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                    Select Destination
                </Text>
                {renderDestinationButtons()}
            </View>

            <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                    Selected Icon
                </Text>
                <View style={styles.iconPreviewRow}>
                    <View style={[styles.iconPreviewChip, { borderColor: theme.colors?.outline ?? 'rgba(0,0,0,0.12)', backgroundColor: theme.colors?.surfaceVariant ?? 'rgba(0,0,0,0.04)' }]}>
                        <List.Icon icon={selectedIcon} color={theme.colors?.primary} style={styles.iconPreviewIcon} />
                        <Text variant="bodyMedium" numberOfLines={1} style={styles.iconPreviewLabel}>
                            {selectedIconOption.label}
                        </Text>
                    </View>
                    <Button
                        mode="outlined"
                        compact
                        uppercase={false}
                        icon="palette"
                        onPress={() => setActivePage('icon')}
                        style={styles.chooseIconButton}
                    >
                        Choose Icon
                    </Button>
                </View>
            </View>

            
        </View>
    );

    const renderIconPage = () => (
        <View style={styles.iconPickerContainer}>
            <View style={styles.iconPickerHeader}>
                <PaperIconButton
                    icon="arrow-left"
                    size={20}
                    onPress={() => setActivePage('details')}
                    accessibilityLabel="Back to button settings"
                />
                <Text variant="titleMedium" style={styles.iconPickerTitle}>
                    Choose an Icon
                </Text>
            </View>
            <ScrollView contentContainerStyle={styles.iconScroll}>
                <View style={styles.iconList}>
                    {ICON_CHOICES.map((iconOption) => {
                        const isSelected = selectedIconId === iconOption.id;
                        return (
                            <View key={iconOption.id} style={styles.iconButtonWrapper}>
                                <IconButton
                                    icon={iconOption.icon}
                                    onPress={() => handleIconSelect(iconOption)}
                                    focused={isSelected}
                                    style={styles.iconListButton}
                                    accessibilityLabel={iconOption.label}
                                />
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );

    return activePage === 'icon' ? renderIconPage() : renderDetailsPage();
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
    errorText: {
        marginTop: -4,
        marginBottom: 8
    },
    destinationsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
    },
    descriptiveButtonWrapper: {
        marginHorizontal: 4,
        marginVertical: 4,
        flexGrow: 0,
    },
    iconPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    iconPreviewChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexShrink: 1
    },
    iconPreviewIcon: {
        margin: 0
    },
    iconPreviewLabel: {
        fontWeight: '500'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingTop: 8
    },
    actionButton: {
        marginLeft: 8
    },

    iconPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    iconPickerTitle: {
        flex: 1,
        fontWeight: '600'
    },
    iconList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },

    iconButtonWrapper: {
        marginHorizontal: 4,
        marginVertical: 4
    },
    iconListButton: {}
});

export default ButtonPicker;
