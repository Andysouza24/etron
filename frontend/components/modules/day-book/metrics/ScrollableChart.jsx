import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

// Width of the pinned y-axis overlay shown when the chart scrolls
// horizontally. Sized to comfortably fit victory-native's default y-axis
// tick labels.
const PINNED_AXIS_WIDTH = 40;

// Horizontal-scroll wrapper around the chart with a duplicate chart
// clipped on the left to keep the y-axis pinned while the body scrolls.
//
// Two operating modes share this component:
//   - paged   - parent passes paging machinery (scrollRef, scrollX,
//               onScroll, onMomentumScrollEnd, chartWidth). Used by the
//               daily display view and aggregation view.
//   - legacy  - parent omits paging machinery; we render a plain
//               horizontal ScrollView pinned to the right.
//
// `renderChart` receives the desired chart width (0 means "no fixed
// width") so the same render function works in both scrollable and
// non-scrollable cases.
const ScrollableChart = ({
    containerWidth,
    onContainerLayout,
    chartWidth,
    renderChart,
    scrollRef,
    onScroll,
    onMomentumScrollEnd,
    isScrollable,
    overlay = null,
}) => {
    if (!isScrollable) {
        return (
            <View style={styles.area} onLayout={onContainerLayout}>
                {renderChart(0)}
                {overlay}
            </View>
        );
    }

    return (
        <View style={styles.area} onLayout={onContainerLayout}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onScroll}
                onMomentumScrollEnd={onMomentumScrollEnd}
                contentContainerStyle={styles.scrollContent}
            >
                {renderChart(chartWidth)}
            </ScrollView>
            <View
                pointerEvents="none"
                style={[styles.pinnedAxis, { width: PINNED_AXIS_WIDTH }]}
            >
                <View style={{ width: containerWidth, height: "100%" }}>
                    {renderChart(containerWidth)}
                </View>
            </View>
            {overlay}
        </View>
    );
};

const styles = StyleSheet.create({
    area: {
        flex: 1,
        width: "100%",
    },
    scrollContent: {
        height: "100%",
    },
    pinnedAxis: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        overflow: "hidden",
    },
});

export default ScrollableChart;
