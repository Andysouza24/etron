const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withAppAuthRedirectScheme(config, { scheme = "myapp" } = {}) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    if (!buildGradle.includes("appAuthRedirectScheme")) {
      config.modResults.contents = buildGradle.replace(
        /defaultConfig\s*{/,
        `defaultConfig {\n        manifestPlaceholders = [appAuthRedirectScheme: "${scheme}"]`
      );
    }

    return config;
  });
};
