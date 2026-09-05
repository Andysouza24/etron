import { Text } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";
import { useRouter } from "expo-router";

const Calculated = () => {
    const router = useRouter();
    const form = useMetricForm();

    return (
        <ResponsiveScreen
            header={<Header title="New Calculated Metric" showBack onBackPress={() => router.back()} />}
            center={false}
            padded
            scroll={true}
        >
            <Text>
                {form.metricType} Metric Creation
            </Text>
        </ResponsiveScreen>
    );
};

export default Calculated;