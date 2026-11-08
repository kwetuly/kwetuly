import { View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { brand, colors, media, radius } from '@/theme';

// Photo or short video inside a group chat bubble (signed link, private to chat members).
export function ChatMedia({ url, type }: { url: string; type: 'image' | 'video' }) {
  if (type === 'image') {
    return <Image source={{ uri: url }} style={{ backgroundColor: colors.fill, width: media.chatMedia, height: media.chatMedia, borderRadius: radius.media }} contentFit="cover" transition={150} />;
  }
  return <ChatVideo url={url} />;
}

function ChatVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <View style={{ width: media.chatMedia, height: media.chatMedia, borderRadius: radius.media, overflow: 'hidden', backgroundColor: brand.shade }}>
      <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="cover" />
    </View>
  );
}
