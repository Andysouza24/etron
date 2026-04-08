import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Card, Chip, IconButton, Menu, Text, useTheme } from 'react-native-paper';

const BoardCard = ({
    board,
    isActive,
    lastUpdated,
    owner,
    isShared,
    onView,
    onEdit,
    onSetAsDashboard,
    onDuplicate,
    onSettings,
    onDelete,
    style
}) => {
    const theme = useTheme();
    const [menuVisible, setMenuVisible] = useState(false);

    const cardStyle = useMemo(() => (
        [
            styles.card,
            style,
            isActive && { borderColor: theme.colors.primary, borderWidth: 2 }
        ]
    ), [isActive, style, theme.colors.primary]);

    const handleToggleMenu = () => setMenuVisible((prev) => !prev);
    const handleDismissMenu = () => setMenuVisible(false);

    const handleMenuAction = (callback) => () => {
        handleDismissMenu();
        callback?.(board);
    };

    const ownerIdValue = owner?.id ?? owner?.userId ?? null;
    const ownerId = ownerIdValue ? String(ownerIdValue) : null;
    const ownerPicture = owner?.picture || null;
    const ownerEmail = owner?.email || null;

    let ownerName = owner?.name || null;
    if (!ownerName) {
        if (ownerEmail) {
            ownerName = ownerEmail;
        } else if (ownerId) {
            ownerName = ownerId.includes('@') ? ownerId : `User ${ownerId.slice(0, 8)}`;
        } else {
            ownerName = 'No owner assigned';
        }
    }

    const buildInitials = (label) => {
        if (!label) return '?';
        const trimmed = String(label).trim();
        if (!trimmed) return '?';
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        const first = parts[0].charAt(0);
        const last = parts[parts.length - 1].charAt(0);
        return `${first}${last}`.toUpperCase();
    };

    const boardTitle = (
        typeof board?.name === 'string' && board.name.trim().length
    ) ? board.name : 'Untitled Board';

    return (
        <Card
            style={cardStyle}
            onPress={() => onView?.(board.id)}
        >
            <Card.Content style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.titleRow}>
                        <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
                            {boardTitle}
                        </Text>
                        {isActive && (
                            <Chip
                                mode="flat"
                                compact
                                style={styles.activeChip}
                                textStyle={styles.activeChipText}
                            >
                                Dashboard
                            </Chip>
                        )}
                    </View>
                    <View style={styles.actionsRow}>
                        <Menu
                            visible={menuVisible}
                            onDismiss={handleDismissMenu}
                            anchor={
                                <IconButton
                                    icon="dots-vertical"
                                    size={20}
                                    onPress={handleToggleMenu}
                                />
                            }
                        >
                            <Menu.Item
                                leadingIcon="eye"
                                onPress={handleMenuAction(() => onView?.(board.id))}
                                title="View"
                            />
                            {!isActive && (
                                <Menu.Item
                                    leadingIcon="view-dashboard"
                                    onPress={handleMenuAction(onSetAsDashboard)}
                                    title="Set as Dashboard"
                                />
                            )}
                            <Menu.Item
                                leadingIcon="content-copy"
                                onPress={handleMenuAction(onDuplicate)}
                                title="Duplicate"
                            />
                            <Menu.Item
                                leadingIcon="cog"
                                onPress={handleMenuAction(onSettings)}
                                title="Settings"
                            />
                            <Menu.Item
                                leadingIcon="delete"
                                onPress={handleMenuAction(onDelete)}
                                title="Delete"
                                titleStyle={{ color: theme.colors.error }}
                            />
                        </Menu>
                    </View>
                </View>

                {board.description ? (
                    <Text
                        variant="bodyMedium"
                        style={styles.description}
                        numberOfLines={2}
                    >
                        {board.description}
                    </Text>
                ) : null}

                <View style={styles.metaRow}>
                    <View style={[styles.metaItem, styles.ownerMeta]}>
                        {ownerPicture ? (
                            <Avatar.Image size={28} source={{ uri: ownerPicture }} />
                        ) : (
                            <Avatar.Text size={28} label={buildInitials(ownerName)} />
                        )}
                        <Text
                            variant="bodySmall"
                            numberOfLines={1}
                            style={styles.ownerName}
                        >
                            {ownerName}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <IconButton icon="clock-outline" size={16} style={styles.metaIcon} />
                        <Text variant="bodySmall">{lastUpdated}</Text>
                    </View>
                    {isShared ? (
                    <View pointerEvents="none" style={styles.metaIcon}>
                        <IconButton
                            icon="account-multiple"
                            size={18}
                            style={styles.metaIcon}
                            iconColor={theme.colors.secondary}
                            containerColor={"transparent"}
                        />
                    </View>
                ) : null}
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 12
    },
    content: {
        position: 'relative'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    titleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10
    },
    title: {
        flex: 1
    },
    activeChip: {
        height: 24,
        marginLeft: 8
    },
    activeChipText: {
        fontSize: 10,
        lineHeight: 10
    },
    description: {
        opacity: 0.7,
        marginTop: 8,
        marginBottom: 12
    },
    metaRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    ownerMeta: {
        flex: 1,
        gap: 8
    },
    ownerName: {
        flex: 1
    },
    metaIcon: {
        margin: 0
    },
    sharedBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'transparent'
    },
    sharedBadgeIcon: {
        margin: 0
    }
});

export default React.memo(BoardCard);
