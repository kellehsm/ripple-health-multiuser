import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { registerForegroundServiceHandler } from './src/lib/foregroundService';

// Must be called before registerRootComponent so notifee's headless handler
// is registered before any notification can trigger it.
registerForegroundServiceHandler();

// Handle action-button presses on smart reminders when the app is in the background.
// "Log meal" actions have launchActivity:'default' so they open the app automatically.
// All other actions (dismiss/skip/ack) just cancel the notification.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.notification?.id) {
    await notifee.cancelNotification(detail.notification.id);
  }
});

registerRootComponent(App);
