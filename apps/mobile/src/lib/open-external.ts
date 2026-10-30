// Opens a link that came from the database (an operator's website, a source page, a business site).
// Only plain https addresses are opened; anything else (javascript:, intent:, tel:, other apps'
// schemes, links with a user name or odd port) is refused, so a bad value can never launch another app.
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { safeExternalUrl } from '@kwetuly/shared';

export async function openExternal(url: string | null | undefined, options: { inApp?: boolean } = {}): Promise<boolean> {
  const safe = safeExternalUrl(url);
  if (!safe) return false;
  try {
    if (options.inApp) await WebBrowser.openBrowserAsync(safe);
    else await Linking.openURL(safe);
    return true;
  } catch {
    return false;
  }
}
