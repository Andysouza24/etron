// Author(s): Rhys Cleary

import { View, StyleSheet} from 'react-native';
import { Button, useTheme } from 'react-native-paper';

const BasicButton = ({
    danger = false,
    altBackground = false,
    altText = false,
    label,
    onPress,
    fullWidth = false,
    style,
    disabled = false,
    icon,
    loading = false,
    mode = 'contained',
    contentStyle,
    ...rest
}) => {
    const theme = useTheme();
    
    const isContained = mode === 'contained';

    const resolveButtonColor = () => {
        if (!isContained) return undefined;
        if (danger) {
            return theme.colors.error;
        }
        if (altBackground) {
            return theme.colors.buttonBackground;
        }
        return theme.colors.primary;
    };

    const resolveTextColor = () => {
        if (isContained) {
            if (altText) {
                return theme.colors.textAlt;
            }
            return theme.colors.onPrimary ?? theme.colors.text;
        }

        if (danger) {
            return theme.colors.error;
        }
        if (altText) {
            return theme.colors.textAlt;
        }
        return theme.colors.primary;
    };

    const buttonColor = resolveButtonColor();
    const textColor = resolveTextColor();

    return (
        <Button 
            compact  
            mode={mode} 
            textColor={textColor}  
            buttonColor={buttonColor}
            disabled={disabled}
            style={[
                styles.button,
                fullWidth ? styles.fullWidth : styles.fixedWidth,
                style
            ]}
            onPress={onPress}
            icon={icon}
            loading={loading}
            contentStyle={contentStyle}
            {...rest}
        >
            {label}
        </Button>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: 10,
    },
    fixedWidth: {
        width: 145,
        maxWidth: "100%",
        flexShrink: 1
    },
    fullWidth: {
        width: '100%',
    },
});

export default BasicButton;