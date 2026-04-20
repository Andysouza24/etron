import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Card, IconButton, useTheme } from "react-native-paper";
import TextField from "../../../../common/input/TextField";
import { metricStepStyles } from "../../../../../assets/styles/stylesheets/day-book/modules/metrics/metricStep";
import ColorPicker from "react-native-wheel-color-picker";
import ViewShot from "react-native-view-shot";
import GraphPreview from "../GraphPreview";
import CustomiseOptions from "../CustomiseOptions";
import VariableChipSelector from "../VariableChipSelector";

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
    selectedMetric,
    setSelectedMetric,
    maxValue,
    setMaxValue,
    capPercentAt100,
    setCapPercentAt100,
    boxGrouping,
    setBoxGrouping,
    boxTimePeriod,
    setBoxTimePeriod,
    pieLabelPlacement,
    setPieLabelPlacement,
    rounding,
    setRounding,
    numberFormat,
    setNumberFormat,
    percentRounding,
    setPercentRounding,
    axisNumberFormat,
    setAxisNumberFormat,
    rawGraphData,
    boxUseRawData,
    setBoxUseRawData,
    alerts,
    setAlerts,
    userId,
    workspaceId,
    workspaceUsers,
}) {
    const theme = useTheme();
    const [isNameSaved, setIsNameSaved] = useState(false);

    const handleSaveName = () => {
        if (metricName.trim()) {
            setIsNameSaved(true);
        }
    };

    return (
        <View>
            {isNameSaved ? (
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text, flex: 1 }}>
                        {metricName}
                    </Text>
                    <IconButton icon="pencil" size={20} onPress={() => setIsNameSaved(false)} />
                </View>
            ) : (
                <TextField
                    label="Metric Name"
                    placeholder="Metric Name"
                    onChangeText={setMetricName}
                    value={metricName}
                    customRightButton={!!metricName.trim()}
                    rightButtonIcon="check"
                    rightButtonPress={handleSaveName}
                    onBlur={handleSaveName}
                />
            )}

            <VariableChipSelector
                dependentVariables={dependentVariables}
                wheelIndex={wheelIndex}
                setWheelIndex={setWheelIndex}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
                {/*<ColorPicker
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
                />*/}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
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
                                    maxValue={maxValue}
                                    capPercentAt100={capPercentAt100}
                                    boxGrouping={boxGrouping}
                                    boxTimePeriod={boxTimePeriod}
                                    pieLabelPlacement={pieLabelPlacement}
                                    rounding={rounding}
                                    numberFormat={numberFormat}
                                    percentRounding={percentRounding}
                                    axisNumberFormat={axisNumberFormat}
                                    rawGraphData={rawGraphData}
                                    boxUseRawData={boxUseRawData}
                                />
                            </View>
                        </ViewShot>
                    </Card.Content>
                </Card>
            </View>

            <View style={{ marginTop: 16 }}>
                <CustomiseOptions
                    selectedMetric={selectedMetric}
                    setSelectedMetric={setSelectedMetric}
                    maxValue={maxValue}
                    setMaxValue={setMaxValue}
                    capPercentAt100={capPercentAt100}
                    setCapPercentAt100={setCapPercentAt100}
                    boxGrouping={boxGrouping}
                    setBoxGrouping={setBoxGrouping}
                    boxTimePeriod={boxTimePeriod}
                    setBoxTimePeriod={setBoxTimePeriod}
                    pieLabelPlacement={pieLabelPlacement}
                    setPieLabelPlacement={setPieLabelPlacement}
                    rounding={rounding}
                    setRounding={setRounding}
                    numberFormat={numberFormat}
                    setNumberFormat={setNumberFormat}
                    percentRounding={percentRounding}
                    setPercentRounding={setPercentRounding}
                    axisNumberFormat={axisNumberFormat}
                    setAxisNumberFormat={setAxisNumberFormat}
                    rawGraphData={rawGraphData}
                    boxUseRawData={boxUseRawData}
                    setBoxUseRawData={setBoxUseRawData}
                    alerts={alerts}
                    setAlerts={setAlerts}
                    dependentVariables={dependentVariables}
                    userId={userId}
                    workspaceId={workspaceId}
                    workspaceUsers={workspaceUsers}
                />
            </View>
        </View>
    );
}
