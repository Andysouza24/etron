import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";

const themeColors = {
    primary: '#BBEFFB',
    secondary: '#4A519F',
    lightNeutral: '#EEF1F6',
    darkNeutral: '#40484C',

    brightPink: '#EF476F',
    brightPinkObverse: '#360726',

    orange: '#F78C6F',
    orangeObverse: '#451B03',

    yellow: '#FFD166',
    yellowObverse: '#543512',

    lime: '#B3E11D',
    limeObverse: '#061E16',

    green: '#06D6A0',
    greenObverse: '#0E3529',

    blue: '#2DC6E8',
    blueObverse: '#07385A',

    lightBlue: '#BCD4F6',
    lightBlueObverse: '#293158',

    purple: '#CCC1EC',
    purpleObverse: '#5D2353',

    black: '#000000',
    inverseGrey: '#1D1A1A',
    inverseDarkGrey: '#545454',
    darkGrey: '#ABABAB',
    grey: '#E2E5E5',
    white: '#FFFFFF',

    lightBackground: '#FFFFFF',
    darkBackground: '#181C1F',
}

const trend = {
    positiveSurface: '#AFEDDD', // chip background for positive trend
    positiveOnSurface: '#00916B', // onSurface (icon) color for positive trend
    positiveOnSurfaceText: '#007154', // text color for positive trend

    negativeSurface: '#F6D4DC', // chip background for negative trend
    negativeOnSurface: '#E23B63', // onSurface (icon) color for negative trend
    negativeOnSurfaceText: '#BB1E43', // text color for negative trend

    flatSurface: themeColors.lightNeutral, // chip background for no/neutral trend
    flatOnSurface: themeColors.darkNeutral, // onSurface (icon) color for no/neutral trend
    flatOnSurfaceText: themeColors.darkNeutral, // text color for no/neutral trend
}


const LightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        ...themeColors,
        //primary: themeColors.primary, // overridden by generated
        //secondary: themeColors.secondary, // overridden by generated
        text: themeColors.darkNeutral,
        textAlt: themeColors.black,
        placeholderText: themeColors.darkGrey,
        //outline: themeColors.primary, // overridden by generated
        buttonBackground: themeColors.grey, // background for cards and outlined buttons
        buttonBackgroundAlt: themeColors.lightNeutral,
        //background: themeColors.lightBackground, // overridden by generated
        lowOpacityButton: "rgba(247, 247, 247, 0.3)",
        midOpacityButton: "rgba(247, 247, 247, 0.7)",
        lowOpacityText: "rgba(29, 29, 29, 1)",
        //error: themeColors.brightPink, // overridden by generated
        //error: '#EF4747', // red version
        icon: themeColors.darkNeutral,
        divider: themeColors.lightNeutral,
        navigationRailBackground: themeColors.lightNeutral,
        themeGreen: themeColors.green,
        themeGrey: themeColors.darkGrey,
        textGreen: themeColors.greenObverse, // green text
        focusedBackground: themeColors.darkNeutral,
        altGM: themeColors.inverseGrey,
        //surface: themeColors.lightBackground, // overridden by generated
        //onTile: themeColors.primary,
        activeBackground: themeColors.secondary,
        // ---- METRICS ----

        metricsPink: themeColors.brightPink,
        metricsOrange: themeColors.orange,
        metricsYellow: themeColors.yellow,
        metricsLime: themeColors.lime,
        metricsGreen: themeColors.green,
        metricsBlue: themeColors.blue,
        metricsLightBlue: themeColors.lightBlue,
        metricsPurple: themeColors.purple,

        metricsPinkObverse: themeColors.brightPinkObverse,
        metricsOrangeObverse: themeColors.orangeObverse,
        metricsYellowObverse: themeColors.yellowObverse,
        metricsLimeObverse: themeColors.limeObverse,
        metricsGreenObverse: themeColors.greenObverse,
        metricsBlueObverse: themeColors.blueObverse,
        metricsLightBlueObverse: themeColors.lightBlueObverse,
        metricsPurpleObverse: themeColors.purpleObverse,

        lightNeutral: themeColors.lightNeutral,
        darkNeutral: themeColors.darkNeutral,

        trend,

        // ---- generated (from M3 Theme Builder) ----

        primary: "#326670",
        surfaceTint: "#326670",
        onPrimary: "#FFFFFF",
        primaryContainer: "#BBEFFB",
        onPrimaryContainer: "#3B6E78",
        secondary: "#575B87",
        onSecondary: "#FFFFFF",
        secondaryContainer: "#C9CCFF",
        onSecondaryContainer: "#515581",
        tertiary: "#4F6357",
        onTertiary: "#FFFFFF",
        tertiaryContainer: "#B6CCBE",
        onTertiaryContainer: "#43574C",
        error: "#B41547",
        onError: "#FFFFFF",
        errorContainer: "#D6345E",
        onErrorContainer: "#FFFBFF",
        background: "#F9F9FA",
        onBackground: "#191C1D",
        surface: "#FCF8F8",
        onSurface: "#1C1B1C",
        surfaceVariant: "#E0E3E5",
        onSurfaceVariant: "#43474A",
        outline: "#74787A",
        outlineVariant: "#C4C7C9",
        shadow: "#000000",
        scrim: "#000000",
        inverseSurface: "#313030",
        inverseOnSurface: "#F3F0F0",
        inversePrimary: "#9CCFDB",
        elevation: {
            level0: "transparent",
            level1: "rgb(245,247,248)",
            level2: "rgb(239,243,244)",
            level3: "rgb(232,238,239)",
            level4: "rgb(230,237,238)",
            level5: "rgb(226,234,235)",
        },
        surfaceDisabled: "rgba(28, 27, 28, 0.12)",
        onSurfaceDisabled: "rgba(28, 27, 28, 0.38)",
        backdrop: "rgba(59, 59, 60, 0.4)",
    }

};

const DarkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        //primary: '#118AB2', // overridden by generated
        //secondary: '#577590', // overridden by generated
        text: '#F7F7F7',
        textAlt: '#FFFFFF',
        placeholderText: '#7a7a7aff',
        //outline: '#577590', // overridden by generated
        //outline: '#476580', // overridden by generated
        //buttonBackground: '#2B2B2B', // background for cards and outlined buttons
        buttonBackgroundAlt: '#2A2A2A',
        buttonBackground: "#2C2C2C",
        //background: "rgb(29, 27, 30)", // overridden by generated

        lowOpacityButton: "rgba(44, 44, 44, 0.3)",
        midOpacityButton: "rgba(30, 30, 30, 0.7)",
        lowOpacityText: "rgba(247, 247, 247, 1)",

        //error: '#EF476F', // overridden by generated
        //error: '#EF4747', // red version
        icon: '#F7F7F7',
        divider: '#6C6C6C',
        navigationRailBackground: '#1D4364',
        themeGreen: '#06D6A0',
        themeGrey: '#ABABAB',
        textGreen: '#008663', // green text
        focusedBackground: '#263e46', // #118AB2 at 20% opacity

        altGM: '#F7F7F7',
        //surface: "#1E1E1E", // overridden by generated
        //onTile: themeColors.primary,

        // ---- METRICS ----

        metricsPink: themeColors.brightPink,
        metricsOrange: themeColors.orange,
        metricsYellow: themeColors.yellow,
        metricsLime: themeColors.lime,
        metricsGreen: themeColors.green,
        metricsBlue: themeColors.blue,
        metricsLightBlue: themeColors.lightBlue,
        metricsPurple: themeColors.purple,

        metricsPinkObverse: themeColors.brightPinkObverse,
        metricsOrangeObverse: themeColors.orangeObverse,
        metricsYellowObverse: themeColors.yellowObverse,
        metricsLimeObverse: themeColors.limeObverse,
        metricsGreenObverse: themeColors.greenObverse,
        metricsBlueObverse: themeColors.blueObverse,
        metricsLightBlueObverse: themeColors.lightBlueObverse,
        metricsPurpleObverse: themeColors.purpleObverse,

        trend,

        // ---- generated (from M3 Theme Builder) ----
        primary: "#FFFFFF",
        surfaceTint: "#9CCFDB",
        onPrimary: "#00363E",
        primaryContainer: "#B7EBF7",
        onPrimaryContainer: "#396C76",
        secondary: "#EBEAFF",
        onSecondary: "#292D56",
        secondaryContainer: "#C9CCFF",
        onSecondaryContainer: "#515581",
        tertiary: "#D2E8DA",
        onTertiary: "#21342B",
        tertiaryContainer: "#B6CCBE",
        onTertiaryContainer: "#43574C",
        error: "#FFB2BC",
        onError: "#670023",
        errorContainer: "#FD5179",
        onErrorContainer: "#470015",
        background: "#111414",
        onBackground: "#E2E3E3",
        surface: "#131313",
        onSurface: "#E5E2E1",
        surfaceVariant: "#43474A",
        onSurfaceVariant: "#C4C7C9",
        outline: "#8D9194",
        outlineVariant: "#43474A",
        shadow: "#000000",
        scrim: "#000000",
        inverseSurface: "#E5E2E1",
        inverseOnSurface: "#313030",
        inversePrimary: "#326670",
        elevation: {
            level0: "transparent",
            level1: "rgb(26, 28, 29)",
            level2: "rgb(30, 34, 35)",
            level3: "rgb(34, 40, 41)",
            level4: "rgb(35, 42, 43)",
            level5: "rgb(38, 45, 47)",
        },
        surfaceDisabled: "rgba(229, 226, 225, 0.12)",
        onSurfaceDisabled: "rgba(229, 226, 225, 0.38)",
        backdrop: "rgba(59, 59, 60, 0.4)",
    },
};

export const themes = {
    light: LightTheme,
    dark: DarkTheme
}