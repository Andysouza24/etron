import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

// Shared OAuth provider button (Google, Microsoft, …).
// Provider-specific content is supplied by the caller via imageSource + label,
// so this component only owns the common bordered layout.
const OAuthButton = ({
    icon,
    imageSource,
    label,
    onPress,
    style,
}) => {
    const theme = useTheme();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.button,
                {
                    borderColor: theme.colors.altGM,
                    backgroundColor: theme.colors.background
                },
                style,
            ]}
        >

        <View style={styles.innerContainer}>
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
            ) : icon ? (
                <Icon
                    source={icon}
                    size={24}
                    color={theme.colors.icon}
                    style={styles.icon}
                />
            ) : null}

            <Text style={[styles.labelText, { color: theme.colors.altGM, marginLeft: 10 }]}>
                {label}
            </Text>
        </View>

        </Pressable>
    );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    width: '100%',
    borderWidth: 1,
    marginVertical: 6,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',  // center horizontally
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 10,
  },
  logoImage: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  labelText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default OAuthButton;
