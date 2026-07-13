const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'android-widget');

function withAndroidWidget(config) {
  // Copy native files into the generated Android project during prebuild
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const root = mod.modRequest.platformProjectRoot;

      const ktDir = path.join(root, 'app/src/main/java/com/kellehs/wellness');
      fs.mkdirSync(ktDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'RippleWidgetProvider.kt'), path.join(ktDir, 'RippleWidgetProvider.kt'));

      const layoutDir = path.join(root, 'app/src/main/res/layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget.xml'), path.join(layoutDir, 'ripple_widget.xml'));

      const drawableDir = path.join(root, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget_bg.xml'), path.join(drawableDir, 'ripple_widget_bg.xml'));

      const xmlDir = path.join(root, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget_info.xml'), path.join(xmlDir, 'ripple_widget_info.xml'));

      return mod;
    },
  ]);

  // Register the AppWidgetProvider receiver in AndroidManifest.xml
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];

    const alreadyAdded = app.receiver.some(
      (r) => r.$['android:name'] === 'com.kellehs.wellness.RippleWidgetProvider'
    );

    if (!alreadyAdded) {
      app.receiver.push({
        $: {
          'android:name': 'com.kellehs.wellness.RippleWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/ripple_widget_info',
            },
          },
        ],
      });
    }

    return mod;
  });

  return config;
}

module.exports = withAndroidWidget;
