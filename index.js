import { registerRootComponent } from 'expo';
import App from './App';
import { registerForegroundServiceHandler } from './src/lib/foregroundService';

// Must be called before registerRootComponent so notifee's headless handler
// is registered before any notification can trigger it.
registerForegroundServiceHandler();

registerRootComponent(App);
