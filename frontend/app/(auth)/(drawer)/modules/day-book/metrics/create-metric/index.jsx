import { useRouter } from "expo-router";
import { RadioButton, Text, useTheme } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import { View } from "react-native";
import { useState } from "react";
import BasicButton from "../../../../../../../components/common/buttons/BasicButton";
import { metricTypeOptions } from "../../../../../../../utils/constants/modules/day-book/metrics/metricType";


const SelectMetricType = () => {
    const router = useRouter();
    const theme = useTheme();
    const [type, setType] = useState(null);
    const selectedType = metricTypeOptions.find(t => t.key === type);
    const handleContinue = () => {
        if (selectedType) {
            router.push({
                pathname: selectedType.route,
                params: { metricType: selectedType.key },
            });
        }
    };

    return (
        <ResponsiveScreen
            header={<Header title="New Metric" showBack onBackPress={() => router.back()} />}
            center={false}
            padded
            scroll={true}
        > 
            <View /*add container styling*/>
                <Text /* add heading styling */>
                    Choose Metric Type:
                </Text>
                <View /* add list styling */>
                    <RadioButton.Group onValueChange={setType} value={type}>
                        {metricTypeOptions.map((metricType) => (
                          <View key={metricType.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                            <RadioButton value={metricType.key} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={{ fontSize: 16, fontWeight: "600" }}>
                                {metricType.title}
                              </Text>
                              <Text 
                                numberOfLines={1} 
                                ellipsizeMode="tail"
                                style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}
                              >
                                {metricType.description}
                              </Text>
                            </View>
                          </View>
                        ))}
                    </RadioButton.Group>
                </View>
            </View>
            <View>
                <BasicButton
                    label="Next"
                    onPress={handleContinue}
                    disabled={!selectedType}
                />
            </View>
        </ResponsiveScreen>
    );
};

export default SelectMetricType;