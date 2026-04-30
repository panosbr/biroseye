// Κοινό helper για πραγματικό τερματισμό της εφαρμογής.
// Προσπαθεί πρώτα native kill με react-native-exit-app, αλλιώς fallback σε BackHandler.
import { BackHandler, AppState } from 'react-native';

let RNExitApp = null;
try {
  // Το package κάνει autolink με Expo prebuild — import dynamically για να
  // μη σπάσει η εφαρμογή αν λείπει (π.χ. σε dev client χωρίς prebuild)
  RNExitApp = require('react-native-exit-app').default;
} catch (e) {
  RNExitApp = null;
}

export function hardExit() {
  // Ασφάλεια: μόνο αν είμαστε foreground
  if (AppState.currentState !== 'active') return;

  // 1. Native kill — System.exit(0) στο Android
  if (RNExitApp && typeof RNExitApp.exitApp === 'function') {
    try {
      RNExitApp.exitApp();
      return;
    } catch (e) {}
  }

  // 2. Fallback — BackHandler (κλείνει activity, process μπορεί να μείνει)
  try {
    BackHandler.exitApp();
  } catch (e) {}
}
