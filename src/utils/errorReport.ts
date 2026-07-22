import { Alert, Linking, Platform } from 'react-native';
import { api } from '../api/client';

const REPORT_EMAIL = 'kjsmyre@gmail.com';

export async function reportError(message: string, context?: string): Promise<void> {
  try {
    const res: any = await api.submitErrorReport(message, context, Platform.OS);
    const num = res?.report_number ?? '???';
    const subject = encodeURIComponent(`Ripple Error Report #${num}`);
    const body = encodeURIComponent(
      [
        `Report #${num}`,
        `Date: ${new Date().toLocaleString()}`,
        `Platform: ${Platform.OS}`,
        context ? `Context: ${context}` : null,
        ``,
        `Error: ${message}`,
        ``,
        `Additional notes:`,
        `(Please describe what you were doing when this error occurred)`,
      ].filter(Boolean).join('\n')
    );
    await Linking.openURL(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`);
  } catch {
    // If we can't reach the server, still open mail with a local number
    const subject = encodeURIComponent('Ripple Error Report');
    const body = encodeURIComponent(
      [
        `Date: ${new Date().toLocaleString()}`,
        `Platform: ${Platform.OS}`,
        context ? `Context: ${context}` : null,
        ``,
        `Error: ${message}`,
        ``,
        `Additional notes:`,
        `(Please describe what you were doing when this error occurred)`,
      ].filter(Boolean).join('\n')
    );
    await Linking.openURL(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`);
  }
}

export function showErrorAlert(
  title: string,
  message: string,
  context?: string,
  extraButtons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
): void {
  Alert.alert(title, message, [
    ...(extraButtons ?? []),
    {
      text: 'Report',
      onPress: () => void reportError(message, context ?? title),
    },
    { text: 'OK', style: 'cancel' },
  ]);
}
