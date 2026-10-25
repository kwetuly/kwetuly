import { Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SITE_URL } from './supabase';

/** Opens the phone's share sheet (WhatsApp, Instagram, Facebook, TikTok…) with a link to a Kwetuly page. */
export async function shareLink(path: string, message: string) {
  const url = `${SITE_URL}${path}`;
  await Share.share({ message: `${message} ${url}`, url, title: 'Kwetuly' });
}

/** Downloads a chat photo/video and hands the file itself to the share sheet, e.g. to post it on Instagram. */
export async function shareMediaFile(url: string, name: string) {
  const directory = new Directory(Paths.cache, 'shared-media');
  if (!directory.exists) directory.create();
  const target = new File(directory, name);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
}
