import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';

const DEFAULT_OPTIONS = (handlers) => ([
    {
        key: 'metric',
        title: 'Metric',
        description: 'Add a data metric visualization',
        icon: 'chart-line',
        onPress: handlers.onSelectMetric
    },
    {
        key: 'button',
        title: 'Button',
        description: 'Add a navigation button',
        icon: 'gesture-tap-button',
        onPress: handlers.onSelectButton
    },
    {
        key: 'text',
        title: 'Text',
        description: 'Add a formatted text block',
        icon: 'format-text',
        onPress: handlers.onSelectText
    }
]);

const AddItemPicker = ({ options, onSelectMetric, onSelectButton, onSelectText }) => {
    const effectiveOptions = useMemo(() => {
        if (Array.isArray(options) && options.length > 0) {
            return options;
        }

        return DEFAULT_OPTIONS({ onSelectMetric, onSelectButton, onSelectText })
            .filter(option => typeof option.onPress === 'function');
    }, [options, onSelectMetric, onSelectButton, onSelectText]);

    return (
        <View style={styles.container}>
            {effectiveOptions.map((option) => (
                <List.Item
                    key={option.key}
                    title={option.title}
                    description={option.description}
                    left={(props) => <List.Icon {...props} icon={option.icon} />}
                    onPress={option.onPress}
                    style={styles.item}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8
    },
    item: {
        borderRadius: 8,
        marginHorizontal: 8,
        marginVertical: 4
    }
});

export default AddItemPicker;
