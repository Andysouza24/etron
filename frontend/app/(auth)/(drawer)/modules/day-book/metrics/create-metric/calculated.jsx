import { useRouter } from "expo-router";
import { RadioButton, Text, useTheme } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import { View } from "react-native";
import { useState } from "react";


const Calculated = () => {
    

    return (
        <ResponsiveScreen
            header={<Header title="New Calculated Metric" showBack onBackPress={() => router.back()} />}
            center={false}
            padded
            scroll={true}
        >
            <Text>
                Calculated Metric Creation
            </Text>
        </ResponsiveScreen>
        
    );
};

export default Calculated;