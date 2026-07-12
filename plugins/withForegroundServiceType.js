const { withAndroidManifest } = require('@expo/config-plugins');

// Overrides notifee's default foregroundServiceType (shortService) to dataSync,
// which allows the service to run for data synchronization tasks on Android 14+.
// Also adds the FOREGROUND_SERVICE_DATA_SYNC permission required for API level 34+.
module.exports = function withForegroundServiceType(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const app = manifest.manifest.application[0];

    // Override the notifee ForegroundService entry's foregroundServiceType
    if (app.service) {
      for (const service of app.service) {
        if (service.$['android:name'] === 'app.notifee.core.ForegroundService') {
          service.$['android:foregroundServiceType'] = 'dataSync';
          service.$['tools:replace'] = 'android:foregroundServiceType';
        }
      }
    }

    // Ensure tools namespace is declared on the manifest root
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return mod;
  });
};
