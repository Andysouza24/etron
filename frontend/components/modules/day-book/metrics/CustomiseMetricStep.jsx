import { ScrollView, View } from "react-native";
import { Card, Chip, useTheme } from "react-native-paper";
import TextField from "../../../common/input/TextField";
import {metricStepStyles} from "../../../../assets/styles/stylesheets/day-book/modules/metrics/metricStep";
import ColorPicker from "react-native-wheel-color-picker";
import ViewShot from "react-native-view-shot";



export default function CustomiseMetricStep({ form, dependentVariables = [], graphPreview, viewShotRef }) {
    const theme = useTheme();
    const { metricName, setMetricName, coloursState, setColoursState, wheelIndex, setWheelIndex } = form;

    return (
        <ScrollView>
            <TextField
                label="Metric Name"
                placeholder="Metric Name"
                onChangeText={setMetricName}
                value={metricName}
            />

            {/* variable colour selector chips */}
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

            {/* colour picker */}
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

            {/* graph preview */}
            <Card style={metricStepStyles.card}>
                <Card.Content>
                    <ViewShot
                        ref={viewShotRef}
                        options={{ format: "png", quality: 1.0, result: "tmpfile" }}
                    >
                        <View style={metricStepStyles.graphContainer}>
                            {typeof graphPreview === "function" ? graphPreview({colours: coloursState}) : graphPreview}
                        </View>
                    </ViewShot>
                </Card.Content>
            </Card>
        </ScrollView>
    )
}