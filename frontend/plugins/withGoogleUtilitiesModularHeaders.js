const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// GoogleSignIn pulls in AppCheckCore, a Swift pod that imports GoogleUtilities and
// RecaptchaInterop. Those are Objective-C pods that don't define modules, so CocoaPods
// refuses to integrate them as static libraries. Opting just these two into modular
// headers fixes it without applying `use_modular_headers!` to every pod.
const MODULAR_PODS = ["GoogleUtilities", "RecaptchaInterop"];

module.exports = function withGoogleUtilitiesModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      const podfile = fs.readFileSync(podfilePath, "utf8");

      const missing = MODULAR_PODS.filter(
        (pod) => !podfile.includes(`pod '${pod}'`),
      );

      if (missing.length) {
        const declarations = missing
          .map((pod) => `  pod '${pod}', :modular_headers => true`)
          .join("\n");

        fs.writeFileSync(
          podfilePath,
          podfile.replace(
            /target 'eTRON' do\n/,
            `target 'eTRON' do\n${declarations}\n`,
          ),
        );
      }

      return config;
    },
  ]);
};
