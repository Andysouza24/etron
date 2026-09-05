// Author(s): Holly Wyatt

import { View } from "react-native";
import Header from "../../../../../../components/layout/Header";
import { commonStyles } from "../../../../../../assets/styles/stylesheets/common";
import { ScrollView } from "react-native";
import StackLayout from "../../../../../../components/layout/StackLayout";
import Divider from "../../../../../../components/layout/Divider"
import { useTheme, Text } from "react-native-paper";
import { router } from "expo-router";
import DescriptiveButton from "../../../../../../components/common/buttons/DescriptiveButton";
import { getAdaptersForUI } from "../../../../../../adapters/day-book/data-sources/DataAdapterFactory";
import ResponsiveScreen from "../../../../../../components/layout/ResponsiveScreen";
import { useDataSourceContext } from "../../../../../../contexts/DataSourceContext";

const CreateDataConnection = () => {
    const theme = useTheme();
    const { dataSources } = useDataSourceContext();

    const hasMicromaxConnection = (dataSources?.list || []).some(
        (s) => (s.sourceType || s.type) === "micromax-dashboard"
    );

    const sourceTypes = getAdaptersForUI()
        .map((category) => {
            const filteredAdapters = category.adapters.filter(
                (adapter) => !(hasMicromaxConnection && adapter.type === "micromax-dashboard")
            );
            return { ...category, adapters: filteredAdapters };
        })
        .filter((category) => category.adapters.length > 0)
        .map((category) => ({
            ...category,
            type: category.adapters.map((adapter) => ({
                ...adapter,
                onPress: () => router.navigate(adapter.route),
            })),
        }));

    return (
        <ResponsiveScreen 
            header={
                <Header title="New Connection" showBack />
            }
            center={false}
            scroll={false}
        >
            <ScrollView contentContainerStyle={commonStyles}>
                <StackLayout spacing={12}>
                    {sourceTypes.map((category, index) => (
                        <StackLayout spacing={20} key={category.heading}>
                            <StackLayout spacing={8}>
                                <Text style={commonStyles.titleText}>{category.heading}</Text>
                                {category.type.map((source) => (
                                    <StackLayout spacing={5} key={source.label}>
                                        <DescriptiveButton 
                                            label={source.label}
                                            icon={source.icon}
                                            onPress={source.onPress}
                                            boldLabel={false}
                                            iconColor={source.iconColor}
                                            transparentBackground
                                        />
                                    </StackLayout>
                                ))}
                            </StackLayout>
                            {index < sourceTypes.length - 1 && (
                                <Divider color={theme.colors.divider}/>
                            )}
                        </StackLayout>
                    ))}
                </StackLayout>
            </ScrollView>
        </ResponsiveScreen>
    )
}

export default CreateDataConnection;