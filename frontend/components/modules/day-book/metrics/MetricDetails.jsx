import { ScrollView, View } from "react-native";
import { Card, Chip, useTheme } from "react-native-paper";
import TextField from "../../../common/input/TextField";
import { metricStepStyles } from "../../../../assets/styles/stylesheets/day-book/modules/metrics/metricStep";
import ColorPicker from "react-native-wheel-color-picker";
import ViewShot from "react-native-view-shot";
import GraphPreview from "./GraphPreview";

export default function MetricDetails({
    metricName,
    setMetricName,
    coloursState,
    setColoursState,
    wheelIndex,
    setWheelIndex,
    dependentVariables = [],
    viewShotRef,
    graphType,
    graphData,
    xKey,
    yKeys,
}) {
    const theme = useTheme();

    return (
        <ScrollView>
            <TextField
                label="Metric Name"
                placeholder="Metric Name"
                onChangeText={setMetricName}
                value={metricName}
            />

            {dependentVariables.length > 0 && (
                <View style={metricStepStyles.chipRow}>
                    {dependentVariables.map((variable, index) => (
                        <Chip
                            key={index}
                            selected={wheelIndex === index}
                            onPress={() => setWheelIndex(index)}
                            style={{
                                marginTop: 4,
                                backgroundColor: wheelIndex === index
                                    ? theme.colors.primary : theme.colors.placeholder,
                            }}
                            showSelectedCheck={false}
                        >
                            {variable ?? `Y${index + 1}`}
                        </Chip>
                    ))}
                </View>
            )}

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
                <ColorPicker
                    color={coloursState[wheelIndex]}
                    onColorChange={(newColor) => {
                        setColoursState((prev) => {
                            const updated = [...prev];
                            updated[wheelIndex] = newColor;
                            return updated;
                        });
                    }}
                    thumbSize={30}
                    sliderSize={30}
                    noSnap={true}
                    gapSize={10}
                    palette={[
                        theme.colors.metricsPink,
                        theme.colors.metricsOrange,
                        theme.colors.metricsYellow,
                        theme.colors.metricsLime,
                        theme.colors.metricsGreen,
                        theme.colors.metricsBlue,
                        theme.colors.metricsLightBlue,
                        theme.colors.metricsPurple,
                    ]}
                />
            </View>

            <Card style={metricStepStyles.card}>
                <Card.Content>
                    <ViewShot
                        ref={viewShotRef}
                        options={{ format: "png", quality: 1.0, result: "tmpfile" }}
                    >
                        <View style={metricStepStyles.graphContainer}>
                            <GraphPreview
                                graphType={graphType}
                                data={graphData}
                                xKey={xKey}
                                yKeys={yKeys}
                                colours={coloursState}
                            />
                        </View>
                    </ViewShot>
                </Card.Content>
            </Card>
        </ScrollView>
    );
}
