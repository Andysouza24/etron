import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SegmentedButtons, useTheme } from "react-native-paper";

// Horizontal-scrolling year selector for the legacy non-display view.
// Pins to the right edge on mount so the most recent year is visible
// first when the row overflows.
const YearFilterBar = ({ years, selectedYear, onChange }) => {
    const theme = useTheme();
    const scrollRef = useRef(null);

    const options = useMemo(
        () => years.map((y) => ({ value: String(y), label: String(y) })),
        [years]
    );

    useEffect(() => {
        if (!scrollRef.current) return undefined;
        const id = setTimeout(() => {
            scrollRef.current?.scrollToEnd?.({ animated: false });
        }, 50);
        return () => clearTimeout(id);
    }, [years.length, selectedYear]);

    const handleChange = (value) => {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) onChange(parsed);
    };

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.content}
            style={styles.scroll}
        >
            <SegmentedButtons
                value={selectedYear != null ? String(selectedYear) : ""}
                onValueChange={handleChange}
                density="small"
                buttons={options}
                theme={theme}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        justifyContent: "flex-end",
    },
});

export default YearFilterBar;
