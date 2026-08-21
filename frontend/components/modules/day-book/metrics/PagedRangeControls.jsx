// Header row shared by the daily display view and the aggregation view
// in MetricGraph: a month picker (or static label) above a chevron
// range selector. Pass `monthReadOnly` (or an empty `months` list) to
// render the month label as plain text.

import { StyleSheet, View } from "react-native";
import DefaultDateRangeSelector from "./Selectors/DefaultDateRangeSelector";
import MonthPickerHeader from "./Selectors/MonthPickerHeader";

const PagedRangeControls = ({
    headerLabel,
    months = [],
    selectedMonthKey = null,
    onMonthChange,
    monthReadOnly = false,
    rangeLabel,
    onPrev,
    onNext,
    disablePrev,
    disableNext,
}) => (
    <View style={styles.wrapper}>
        <MonthPickerHeader
            label={headerLabel}
            months={months}
            selectedKey={selectedMonthKey}
            onChange={onMonthChange ?? (() => {})}
            readOnly={monthReadOnly}
        />
        <DefaultDateRangeSelector
            label={rangeLabel}
            onPrev={onPrev}
            onNext={onNext}
            disablePrev={disablePrev}
            disableNext={disableNext}
        />
    </View>
);

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        alignItems: "center",
    },
});

export default PagedRangeControls;
