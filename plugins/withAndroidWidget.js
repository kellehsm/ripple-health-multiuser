const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'android-widget');

const WIDGET_STRINGS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_label">Ripple Health</string>
  <string name="widget_description">Glucose &amp; steps at a glance</string>
</resources>`;

function withAndroidWidget(config) {
  // Copy native files into the generated Android project during prebuild
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const root = mod.modRequest.platformProjectRoot;
      const pkgName = mod.android?.package || 'com.kellehs.wellness';
      const pkgPath = pkgName.replace(/\./g, '/');

      const ktDir = path.join(root, `app/src/main/java/${pkgPath}`);
      fs.mkdirSync(ktDir, { recursive: true });
      // Rewrite package declaration to match the actual app package
      let ktContent = fs.readFileSync(path.join(SRC, 'RippleWidgetProvider.kt'), 'utf8');
      ktContent = ktContent.replace(/^package .+$/m, `package ${pkgName}`);
      fs.writeFileSync(path.join(ktDir, 'RippleWidgetProvider.kt'), ktContent);

      const layoutDir = path.join(root, 'app/src/main/res/layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget.xml'), path.join(layoutDir, 'ripple_widget.xml'));

      const drawableDir = path.join(root, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget_bg.xml'), path.join(drawableDir, 'ripple_widget_bg.xml'));

      const xmlDir = path.join(root, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(path.join(SRC, 'ripple_widget_info.xml'), path.join(xmlDir, 'ripple_widget_info.xml'));

      const valuesDir = path.join(root, 'app/src/main/res/values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(path.join(valuesDir, 'widget_strings.xml'), WIDGET_STRINGS_XML);

      return mod;
    },
  ]);

  // Register the AppWidgetProvider receiver in AndroidManifest.xml
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];

    const pkgName = mod.android?.package || 'com.kellehs.wellness';
    const receiverClass = `${pkgName}.RippleWidgetProvider`;

    const alreadyAdded = app.receiver.some(
      (r) => r.$['android:name'] === receiverClass
    );

    if (!alreadyAdded) {
      app.receiver.push({
        $: {
          'android:name': receiverClass,
          'android:exported': 'true',
          'android:label': '@string/widget_label',
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
