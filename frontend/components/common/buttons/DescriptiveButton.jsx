import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

const DescriptiveButton = ({
    icon,
    image,
    label,
    description,
    onPress,
    focused = false,
    boldLabel = true,
    transparentBackground = false,
    altText = false,
    noBorder = true,
    showChevron = true,
    iconColor,
    fullWidth = true,
    style,
}) => {
    const theme = useTheme();

    let backgroundColor = transparentBackground
        ? 'transparent'
        : focused
        ? theme.colors.primary
        : theme.colors.buttonBackground;

    const borderWidth = noBorder 
        ? 0 
        : 1;

    const borderColor = noBorder
        ? 'transparent'
        : transparentBackground
        ? theme.colors.secondary
        : theme.colors.outline;

    const textColor = altText 
        ? theme.colors.midOpacityButton 
        : theme.colors.text;

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.descriptiveButton,
                fullWidth ? styles.fullWidth : styles.autoWidth,
                { backgroundColor, borderColor, borderWidth },
                style,
            ]}
        >
            <View style={styles.innerContainer}>
                {image ? (
                    <Image source={image} style={styles.imageIcon} />
                ) : icon ? (
                    <Icon source={icon} size={28} color={iconColor ?? textColor} />
                ) : null}

                <View
                    style={[
                        styles.textContainer,
                        fullWidth ? styles.textContainerFull : styles.textContainerAuto,
                    ]}
                >
                    <Text
                        style={[
                            styles.labelText,
                            { color: textColor },
                            !boldLabel && { fontWeight: 'normal' },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {label}
                    </Text>
                    {description ? (
                        <Text
                            style={[styles.descriptionText, { color: textColor }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {description}
                        </Text>
                    ) : null}
                </View>

                {showChevron && (
                    <Icon source="chevron-right" size={28} color={theme.colors.themeGrey} />
                )}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    descriptiveButton: {
        borderRadius: 10,
        minHeight: 48,
    },
    fullWidth: {
        width: '100%',
    },
    autoWidth: {
        alignSelf: 'flex-start',
    },
    innerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexShrink: 1,
    },
    imageIcon: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    textContainer: {
        marginLeft: 14,
        marginRight: 14,
    },
    textContainerFull: {
        flex: 1,
        flexShrink: 1,
    },
    textContainerAuto: {
        flexShrink: 1,
        flexGrow: 0,
        flexBasis: 'auto',
    },
    labelText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    descriptionText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
});

export default DescriptiveButton;
