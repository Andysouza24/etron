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


const LightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        ...themeColors,
        primary: themeColors.primary,
        secondary: themeColors.secondary,
        text: themeColors.darkNeutral,
        textAlt: themeColors.black,
        placeholderText: themeColors.darkGrey,
        outline: themeColors.primary , // the colour for text input and button outlines
        buttonBackground: themeColors.grey, // background for cards and outlined buttons
        buttonBackgroundAlt: themeColors.lightNeutral,
        background: themeColors.lightBackground,
        lowOpacityButton: "rgba(247, 247, 247, 0.3)",
        midOpacityButton: "rgba(247, 247, 247, 0.7)",
        lowOpacityText: "rgba(29, 29, 29, 1)",
        error: themeColors.brightPink, // error messages and dangerous actions
        //error: '#EF4747', // red version
        icon: themeColors.darkNeutral,
        divider: themeColors.lightNeutral,
        navigationRailBackground: themeColors.lightNeutral,
        themeGreen: themeColors.green,
        themeGrey: themeColors.darkGrey,
        textGreen: themeColors.greenObverse, // green text
        focusedBackground: themeColors.darkNeutral,
        altGM: themeColors.inverseGrey,
        surface: themeColors.lightBackground,
        onTile: themeColors.primary,
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
    }

};

const DarkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#118AB2', 
        secondary: '#577590',
        text: '#F7F7F7',
        textAlt: '#FFFFFF',
        placeholderText: '#7a7a7aff',
        //outline: '#577590', // the colour for text input and button outlines
        outline: '#476580', // new outline?
        //buttonBackground: '#2B2B2B', // background for cards and outlined buttons
        buttonBackgroundAlt: '#2A2A2A',
        buttonBackground: "#2C2C2C",
        background : "rgb(29, 27, 30)",

        lowOpacityButton: "rgba(44, 44, 44, 0.3)",
        midOpacityButton: "rgba(30, 30, 30, 0.7)",
        lowOpacityText: "rgba(247, 247, 247, 1)",

        error: '#EF476F', // error messages and dangerous actions
        //error: '#EF4747', // red version
        icon: '#F7F7F7',
        divider: '#6C6C6C',
        navigationRailBackground: '#1D4364',
        themeGreen: '#06D6A0',
        themeGrey: '#ABABAB',
        textGreen: '#008663', // green text
        focusedBackground: '#263e46', // #118AB2 at 20% opacity

        altGM: '#F7F7F7',
        surface: "#1E1E1E",
        onTile: themeColors.primary,

        // ---- METRICS ----

        metricsPink: themeColors.brightPink,
        metricsOrange: themeColors.orange,
        metricsYellow: themeColors.yellow,
        metricsLime: themeColors.lime,
        metricsGreen: themeColors.green,
        metricsBlue: themeColors.blue,
        metricsLightBlue: themeColors.lightBlue,
        metricsPurple: themeColors.purple,
    },
};

export const themes = {
    light: LightTheme,
    dark: DarkTheme
}