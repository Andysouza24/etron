// Dynamic connection-input route
// Each adapter file owns its own ConnectionScreen component
// this route resolves the component for the requested type and renders it
// Static sibling routes (e.g. local-csv.jsx) take priority for types without an adapter

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native-paper";

import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import Header from "../../../../../../../components/layout/Header";
import { getConnectionScreen } from "../../../../../../../adapters/day-book/data-sources/DataAdapterFactory";

const ConnectionInputRoute = () => {
    const { type } = useLocalSearchParams();
    const Screen = getConnectionScreen(type);

    if (!Screen) {
        return (
            <ResponsiveScreen
                header={<Header title="Connection" showBack />}
                center
            >
                <Text>Unknown connection type: {String(type)}</Text>
            </ResponsiveScreen>
        );
    }

    return <Screen />;
};

export default ConnectionInputRoute;
