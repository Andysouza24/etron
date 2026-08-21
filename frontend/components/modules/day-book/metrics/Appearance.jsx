import { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Text, useTheme, Checkbox } from "react-native-paper";
import BasicButton from "../../../common/buttons/BasicButton";
import DropDown from "../../../common/input/DropDown";
import TextField from "../../../common/input/TextField";
import OptionsHeader from "./OptionsHeader";
import GraphTypes from "./graph-types";
import RoundingSelector from "./Selectors/RoundingSelector";

//TODO: consider moving constants into utils/constants file
//TODO: reorganise and improve appearance settings UI

const BOX_GROUPING_ITEMS = [
    { value: "all", label: "All values" },
    { value: "individual", label: "Individual points" },
    { value: "timePeriod", label: "Per time period" },
];

const BOX_GROUPING_DESCRIPTIONS = {
    all: "Combines all numeric values into a single box plot.",
    individual: "Displays each data point as a scatter point.",
    timePeriod: "Groups values by time period (month, quarter, or year).",
};

const BOX_TIME_PERIOD_ITEMS = [
    { value: "date", label: "Per date" },
    { value: "month", label: "Month" },
    { value: "quarter", label: "Quarter" },
    { value: "year", label: "Year" },
];

const PIE_LABEL_PLACEMENT_ITEMS = [
    { value: "outside", label: "Outside" },
    { value: "inside", label: "Inside slices" },
];

const CURRENCY_ITEMS = [
    { value: "", label: "None" },
    { value: "$", label: "$ Dollar" },
    { value: "€", label: "€ Euro" },
    { value: "£", label: "£ Pound" },
    { value: "¥", label: "¥ Yen / Yuan" },
    { value: "₹", label: "₹ Rupee" },
    { value: "₩", label: "₩ Won" },
    { value: "R", label: "R Rand" },
    { value: "A$", label: "A$ Australian Dollar" },
    { value: "custom", label: "Custom..." },
];

const SEPARATOR_ITEMS = [
    { value: "comma", label: "1,000.00 (comma / full stop)" },
    { value: "period", label: "1.000,00 (full stop / comma)" },
    { value: "space", label: "1 000.00 (space / full stop)" },
    { value: "none", label: "1000.00 (none / full stop)" },
];

const SEPARATOR_MAP = {
    comma: { thousandsSeparator: ",", decimalSeparator: "." },
    period: { thousandsSeparator: ".", decimalSeparator: "," },
    space: { thousandsSeparator: " ", decimalSeparator: "." },
    none: { thousandsSeparator: "", decimalSeparator: "." },
};

function getSeparatorValue(numberFormat) {
    const ts = numberFormat?.thousandsSeparator ?? ",";
    const ds = numberFormat?.decimalSeparator ?? ".";
    if (ts === "," && ds === ".") return "comma";
    if (ts === "." && ds === ",") return "period";
    if (ts === " " && ds === ".") return "space";
    if (ts === "" && ds === ".") return "none";
    return "comma";
}

const DECIMAL_SEPARATOR_ITEMS = [
    { value: ".", label: ". (full stop)" },
    { value: ",", label: ", (comma)" },
];

const THOUSANDS_SEPARATOR_ITEMS = [
    { value: ",", label: ", (comma)" },
    { value: ".", label: ". (full stop)" },
    { value: " ", label: "Space" },
    { value: "", label: "None" },
];

function getAvailableThousandsItems(decimalSeparator) {
    return THOUSANDS_SEPARATOR_ITEMS.filter((item) => item.value !== decimalSeparator);
}

// chart types that support the universal rounding selector
const ROUNDING_CHART_TYPES = ["line", "bar", "pie", "area", "scatter", "box", "progressBar", "progressCircle", "numbers"];

// chart types that plot dates on the X axis
const TIME_SERIES_CHART_TYPES = ["line", "bar", "area", "scatter"];

const X_AXIS_DATE_FORMAT_ITEMS = [
    { value: "auto", label: "Auto (DD/MM)" },
    { value: "DD", label: "DD (≤ 7 days only)" },
    { value: "DD/MM", label: "DD/MM" },
    { value: "DD/MM/YY", label: "DD/MM/YY" },
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
    { value: "timestamp", label: "Timestamp" },
];

export default function Appearance({
    onBack,
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
    xAxisDateFormat,
    setXAxisDateFormat,
    xAxisChronological,
    setXAxisChronological,
}) {
    const theme = useTheme();
    const isProgress = selectedMetric === "progressBar" || selectedMetric === "progressCircle";
    const isBox = selectedMetric === "box";
    const isPie = selectedMetric === "pie";
    const isTimeSeries = TIME_SERIES_CHART_TYPES.includes(selectedMetric);
    const showRounding = ROUNDING_CHART_TYPES.includes(selectedMetric);
    const usesSeparateAxis = axisNumberFormat != null;

    const [customCurrency, setCustomCurrency] = useState(
        numberFormat?.currencySymbol && !CURRENCY_ITEMS.some((c) => c.value === numberFormat.currencySymbol && c.value !== "custom")
            ? numberFormat.currencySymbol
            : ""
    );
    const [isCustomCurrency, setIsCustomCurrency] = useState(
        numberFormat?.currencySymbol && !CURRENCY_ITEMS.some((c) => c.value === numberFormat.currencySymbol && c.value !== "custom")
    );
    const [axisCustomCurrency, setAxisCustomCurrency] = useState(
        axisNumberFormat?.currencySymbol && !CURRENCY_ITEMS.some((c) => c.value === axisNumberFormat.currencySymbol && c.value !== "custom")
            ? axisNumberFormat.currencySymbol
            : ""
    );
    const [isAxisCustomCurrency, setIsAxisCustomCurrency] = useState(
        axisNumberFormat?.currencySymbol && !CURRENCY_ITEMS.some((c) => c.value === axisNumberFormat.currencySymbol && c.value !== "custom")
    );

    const [view, setView] = useState("menu");

    const currentDecimal = numberFormat?.decimalSeparator ?? ".";
    const currentThousands = numberFormat?.thousandsSeparator ?? ",";
    const availableThousands = getAvailableThousandsItems(currentDecimal);

    const axisDecimal = axisNumberFormat?.decimalSeparator ?? ".";
    const axisThousands = axisNumberFormat?.thousandsSeparator ?? ",";
    const availableAxisThousands = getAvailableThousandsItems(axisDecimal);

    if (view === "graphDisplay") {
        return (
            <View style={{ width: "100%" }}>
                <OptionsHeader onBack={() => setView("menu")} />

                <DropDown
                    title="Select Display Type"
                    items={Object.values(GraphTypes).map((g) => ({
                        value: g.value,
                        label: g.label,
                    }))}
                    showRouterButton={false}
                    onSelect={setSelectedMetric}
                    value={selectedMetric}
                />

                {/* display-type-specific options */}
                {isProgress && (
                    <TextField
                        label="Value Required For 100%"
                        placeholder="Auto (latest value)"
                        value={maxValue != null ? String(maxValue) : ""}
                        onChangeText={(text) => {
                            if (text === "") {
                                setMaxValue(null);
                                return;
                            }
                            const parsed = Number(text);
                            if (Number.isFinite(parsed)) {
                                setMaxValue(parsed);
                            }
                        }}
                        onBlur={() => {
                            if (maxValue == null) return;
                            const num = Number(maxValue);
                            if (!Number.isFinite(num) || num <= 0) {
                                setMaxValue(null);
                            }
                        }}
                    />
                )}

                {isProgress && (
                    <TouchableOpacity
                        onPress={() => setCapPercentAt100(!capPercentAt100)}
                        style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 4 }}
                    >
                        <Checkbox
                            status={capPercentAt100 ? "checked" : "unchecked"}
                            onPress={() => setCapPercentAt100(!capPercentAt100)}
                        />
                        <Text style={{ fontSize: 14, color: theme.colors.text }}>Cap percentage at 100%</Text>
                    </TouchableOpacity>
                )}

                {isPie && (
                    <DropDown
                        title="Label Placement"
                        items={PIE_LABEL_PLACEMENT_ITEMS}
                        showRouterButton={false}
                        onSelect={setPieLabelPlacement}
                        value={pieLabelPlacement ?? "outside"}
                    />
                )}

                {isBox && (
                    <>
                        <DropDown
                            title="Box Plot Grouping"
                            items={BOX_GROUPING_ITEMS}
                            showRouterButton={false}
                            onSelect={setBoxGrouping}
                            value={boxGrouping}
                        />

                        <Text style={{ fontSize: 12, color: theme.colors.themeGrey, marginTop: 4, marginBottom: 8, paddingHorizontal: 4 }}>
                            {BOX_GROUPING_DESCRIPTIONS[boxGrouping] ?? ""}
                        </Text>

                        {boxGrouping === "timePeriod" && (
                            <DropDown
                                title="Time Period"
                                items={BOX_TIME_PERIOD_ITEMS}
                                showRouterButton={false}
                                onSelect={setBoxTimePeriod}
                                value={boxTimePeriod}
                            />
                        )}

                        {rawGraphData && (
                            <TouchableOpacity
                                onPress={() => setBoxUseRawData(!boxUseRawData)}
                                style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 4 }}
                            >
                                <Checkbox
                                    status={boxUseRawData ? "checked" : "unchecked"}
                                    onPress={() => setBoxUseRawData(!boxUseRawData)}
                                />
                                <Text style={{ fontSize: 14, color: theme.colors.text }}>Use pre-aggregation data</Text>
                            </TouchableOpacity>
                        )}
                        {rawGraphData && boxUseRawData && (
                            <Text style={{ fontSize: 12, color: theme.colors.themeGrey, marginTop: 2, marginBottom: 8, paddingHorizontal: 4 }}>
                                Uses raw data before aggregation, giving multiple values per time period for a meaningful distribution.
                            </Text>
                        )}
                    </>
                )}

                {isTimeSeries && (
                    <>
                        <Text style={{ fontSize: 14, fontWeight: "bold", color: theme.colors.text, marginTop: 12, marginBottom: 8, paddingHorizontal: 4 }}>
                            X-Axis Dates
                        </Text>

                        <DropDown
                            title="Date Format"
                            items={X_AXIS_DATE_FORMAT_ITEMS}
                            showRouterButton={false}
                            onSelect={setXAxisDateFormat}
                            value={xAxisDateFormat ?? "auto"}
                        />

                        <Text style={{ fontSize: 12, color: theme.colors.themeGrey, marginTop: 2, marginBottom: 8, paddingHorizontal: 4 }}>
                            DD displays the month name above the graph. When the range is longer than 7 days, DD automatically switches to DD/MM.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setXAxisChronological(!(xAxisChronological !== false))}
                            style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 4 }}
                        >
                            <Checkbox
                                status={(xAxisChronological !== false) ? "checked" : "unchecked"}
                                onPress={() => setXAxisChronological(!(xAxisChronological !== false))}
                            />
                            <Text style={{ fontSize: 14, color: theme.colors.text }}>Display chronologically</Text>
                        </TouchableOpacity>

                        <Text style={{ fontSize: 12, color: theme.colors.themeGrey, marginTop: 2, marginBottom: 8, paddingHorizontal: 4 }}>
                            Spaces points proportionally to their dates. When more than 7 days are shown, only some ticks are labelled and the month name is shown when it changes.
                        </Text>
                    </>
                )}

                <BasicButton fullWidth label="Back" onPress={() => setView("menu")} />
            </View>
        );
    }

    if (view === "displayOptions") {
        return (
            <View style={{ width: "100%" }}>
                <OptionsHeader onBack={() => setView("menu")} />

                <Text style={{ fontSize: 14, fontWeight: "bold", color: theme.colors.text, marginTop: 8, marginBottom: 8, paddingHorizontal: 4 }}>
                    Number Formatting
                </Text>

                <DropDown
                    title="Currency Symbol"
                    items={CURRENCY_ITEMS}
                    showRouterButton={false}
                    onSelect={(val) => {
                        if (val === "custom") {
                            setIsCustomCurrency(true);
                            setNumberFormat((prev) => ({ ...prev, currencySymbol: customCurrency }));
                        } else {
                            setIsCustomCurrency(false);
                            setNumberFormat((prev) => ({ ...prev, currencySymbol: val }));
                        }
                    }}
                    value={isCustomCurrency ? "custom" : (numberFormat?.currencySymbol ?? "")}
                />

                {isCustomCurrency && (
                    <TextField
                        label="Custom Currency Symbol"
                        placeholder="e.g. CHF, kr"
                        value={customCurrency}
                        onChangeText={(text) => {
                            setCustomCurrency(text);
                            setNumberFormat((prev) => ({ ...prev, currencySymbol: text }));
                        }}
                    />
                )}

                <DropDown
                    title="Decimal Separator"
                    items={DECIMAL_SEPARATOR_ITEMS}
                    showRouterButton={false}
                    onSelect={(val) => {
                        const newFormat = { ...numberFormat, decimalSeparator: val };
                        if (newFormat.thousandsSeparator === val) {
                            newFormat.thousandsSeparator = val === "." ? "," : ".";
                        }
                        setNumberFormat(newFormat);
                    }}
                    value={currentDecimal}
                />

                <DropDown
                    title="Thousands Separator"
                    items={availableThousands}
                    showRouterButton={false}
                    onSelect={(val) => {
                        setNumberFormat((prev) => ({ ...prev, thousandsSeparator: val }));
                    }}
                    value={currentThousands}
                />

                {/* separate axis formatting toggle */}
                <TouchableOpacity
                    onPress={() => {
                        if (usesSeparateAxis) {
                            setAxisNumberFormat(null);
                        } else {
                            setAxisNumberFormat({ ...numberFormat });
                        }
                    }}
                    style={{ flexDirection: "row", alignItems: "center", marginTop: 12, paddingHorizontal: 4 }}
                >
                    <Checkbox
                        status={usesSeparateAxis ? "checked" : "unchecked"}
                        onPress={() => {
                            if (usesSeparateAxis) {
                                setAxisNumberFormat(null);
                            } else {
                                setAxisNumberFormat({ ...numberFormat });
                            }
                        }}
                    />
                    <Text style={{ fontSize: 14, color: theme.colors.text }}>Use separate axis formatting</Text>
                </TouchableOpacity>

                {usesSeparateAxis && (
                    <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: theme.colors.primary }}>
                        <DropDown
                            title="Axis Currency Symbol"
                            items={CURRENCY_ITEMS}
                            showRouterButton={false}
                            onSelect={(val) => {
                                if (val === "custom") {
                                    setIsAxisCustomCurrency(true);
                                    setAxisNumberFormat((prev) => ({ ...prev, currencySymbol: axisCustomCurrency }));
                                } else {
                                    setIsAxisCustomCurrency(false);
                                    setAxisNumberFormat((prev) => ({ ...prev, currencySymbol: val }));
                                }
                            }}
                            value={isAxisCustomCurrency ? "custom" : (axisNumberFormat?.currencySymbol ?? "")}
                        />

                        {isAxisCustomCurrency && (
                            <TextField
                                label="Axis Custom Currency Symbol"
                                placeholder="e.g. CHF, kr"
                                value={axisCustomCurrency}
                                onChangeText={(text) => {
                                    setAxisCustomCurrency(text);
                                    setAxisNumberFormat((prev) => ({ ...prev, currencySymbol: text }));
                                }}
                            />
                        )}

                        <DropDown
                            title="Axis Decimal Separator"
                            items={DECIMAL_SEPARATOR_ITEMS}
                            showRouterButton={false}
                            onSelect={(val) => {
                                const newFormat = { ...axisNumberFormat, decimalSeparator: val };
                                if (newFormat.thousandsSeparator === val) {
                                    newFormat.thousandsSeparator = val === "." ? "," : ".";
                                }
                                setAxisNumberFormat(newFormat);
                            }}
                            value={axisDecimal}
                        />

                        <DropDown
                            title="Axis Thousands Separator"
                            items={availableAxisThousands}
                            showRouterButton={false}
                            onSelect={(val) => {
                                setAxisNumberFormat((prev) => ({ ...prev, thousandsSeparator: val }));
                            }}
                            value={axisThousands}
                        />
                    </View>
                )}

                {/* rounding */}
                {showRounding && (
                    <>
                        <RoundingSelector rounding={rounding} setRounding={setRounding} />
                        {isProgress && (
                            <RoundingSelector
                                label="Percent Rounding"
                                rounding={percentRounding}
                                setRounding={setPercentRounding}
                            />
                        )}
                    </>
                )}

                <BasicButton fullWidth label="Back" onPress={() => setView("menu")} />
            </View>
        );
    }

    // menu view
    return (
        <View style={{ width: "100%" }}>
            <OptionsHeader onBack={onBack} />

            <BasicButton fullWidth label="Format Graph Display" onPress={() => setView("graphDisplay")} />
            <BasicButton fullWidth label="Format Display Options" onPress={() => setView("displayOptions")} style={{ marginTop: 16 }} />
        </View>
    );
}