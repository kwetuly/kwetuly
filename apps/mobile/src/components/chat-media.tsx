import { View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

// Photo or short video inside a group chat bubble (signed link, private to chat members).
export function ChatMedia({ url, type }: { url: string; type: 'image' | 'video' }) {
  if (type === 'image') {
    return <Image source={{ uri: url }} style={{ width: 240, height: 240, borderRadius: 14 }} contentFit="cover" transition={150} />;
  }
  return <ChatVideo url={url} />;
}

function ChatVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <View style={{ width: 240, height: 240, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="cover" />
    </View>
  );
}
