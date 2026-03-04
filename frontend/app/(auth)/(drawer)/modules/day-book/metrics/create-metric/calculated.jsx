import { Text } from "react-native-paper";
import Header from "../../../../../../../components/layout/Header";
import ResponsiveScreen from "../../../../../../../components/layout/ResponsiveScreen";
import useMetricForm from "../../../../../../../hooks/modules/day_book/metrics/useMetricForm";

const Calculated = () => {
    const form = useMetricForm({ totalSteps: 1 });

    return (
        <ResponsiveScreen
            header={<Header title="New Calculated Metric" showBack onBackPress={form.handleBack} />}
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