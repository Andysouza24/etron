// Author(s): Rhys Cleary

import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Card, Icon, IconButton, Text, useTheme } from "react-native-paper"
import { commonStyles } from "../../assets/styles/stylesheets/common";

// Generic list/detail card: optional left element, title/subtitle/content,
// and a right icon that can be static or pressable. Wraps in a touchable when onPress is set.
const ListCard = ({
    leftElement,
    leftElementType = "icon",
    title,
    subtitle,
    content,
    onPress,
    rightIcon = [],
    cardStyle,
    titleStyle,
    subtitleStyle,
    contentStyle,
    onRightPress,
    rightAccessibilityLabel,
    contentNumberOfLines = 4,
}) => {
    const theme = useTheme();

    const defaultCardStyle = { backgroundColor: theme.colors.buttonBackground };
    const defaultTitleStyle = { color: theme.colors.text, fontSize: 16 };
    const defaultSubtitleStyle = { color: theme.colors.text, fontSize: 15, marginTop: 6 };
    const defaultContentStyle = { color: theme.colors.text, fontSize: 14, lineHeight: 20, marginTop: 8 };

    // render the left element 
    const renderLeftElement = () => {
        if (!leftElement) return null;

        switch (leftElementType) {
            case "icon":
                return typeof leftElement === "string" ? (
                    <Icon source={leftElement} size={32} />
                ) : (
                    leftElement
                );
            case "avatar":
                return typeof leftElement === "string" ? (
                    <Avatar.Icon size={32} icon={leftElement} />
                ) : (
                    leftElement
                );
            case "custom":
                return leftElement;
            default:
                return null;
        }
    }

    const CardBody = (
        <Card
            mode="elevated"
            style={[styles.card, defaultCardStyle, cardStyle]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                {/* Left Icon */}
                {renderLeftElement()}

                {/* Content Block */}
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    {title && (
                        <Text 
                            style={[commonStyles.listItemText, defaultTitleStyle, titleStyle]} 
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                    )}
                    
                    {subtitle && (
                        <Text 
                            style={[commonStyles.captionText, defaultSubtitleStyle, subtitleStyle]}
                            numberOfLines={0}
                        >
                            {subtitle}
                        </Text>
                    )}

                    {content && (
                        <Text 
                            style={[commonStyles.captionText, defaultContentStyle, contentStyle]}
                            numberOfLines={contentNumberOfLines}
                            ellipsizeMode="tail"
                        >
                            {content}
                        </Text>
                    )}
                </View>

                {/* Right Icon */}
                {rightIcon && (
                    typeof rightIcon === 'string' ? (
                        onRightPress ? (
                            <IconButton
                                icon={rightIcon}
                                onPress={onRightPress}
                                size={26}
                                style={{ alignSelf: 'center' }}
                                accessibilityLabel={rightAccessibilityLabel}
                            />
                        ) : (
                            <Icon
                                source={rightIcon}
                                size={26}
                                style={{ alignSelf: 'center' }}
                                accessibilityLabel={rightAccessibilityLabel}
                            />
                        )
                    ) : (
                        rightIcon
                    )
                )}
            </View>

        </Card>
    );


    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress}>
                {CardBody}
            </TouchableOpacity>
        );
    }
    return CardBody;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 8
  }
});

export default ListCard;