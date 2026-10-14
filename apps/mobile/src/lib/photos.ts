import type { ImageSource } from 'expo-image';
import { photoUrl, type Photo } from '@rafrika/shared';

// Rafrika's own photos are bundled with the app (smaller copies of the website's /photos files);
// stock photos load from Unsplash at the requested width.
const LOCAL: Record<string, number> = {
  'kili-camp-mawenzi': require('../../assets/photos/kili-camp-mawenzi.jpg'),
  'saddle-hikers-mawenzi': require('../../assets/photos/saddle-hikers-mawenzi.jpg'),
  'kibo-saddle-hikers': require('../../assets/photos/kibo-saddle-hikers.jpg'),
  'kibo-from-shira': require('../../assets/photos/kibo-from-shira.jpg'),
  'kibo-hut-trail': require('../../assets/photos/kibo-hut-trail.jpg'),
  'kili-moorland-trail': require('../../assets/photos/kili-moorland-trail.jpg'),
  'mawenzi-clouds': require('../../assets/photos/mawenzi-clouds.jpg'),
  'mawenzi-mist': require('../../assets/photos/mawenzi-mist.jpg'),
  'kibo-crater-glacier': require('../../assets/photos/kibo-crater-glacier.jpg'),
  'uhuru-peak': require('../../assets/photos/uhuru-peak.jpg'),
  'kili-rainforest-hikers': require('../../assets/photos/kili-rainforest-hikers.jpg'),
  'kili-rocky-trail': require('../../assets/photos/kili-rocky-trail.jpg'),
  'kili-heather-zone': require('../../assets/photos/kili-heather-zone.jpg'),
  'mountain-hut': require('../../assets/photos/mountain-hut.jpg'),
  'colobus-monkey': require('../../assets/photos/colobus-monkey.jpg'),
  'blue-monkey': require('../../assets/photos/blue-monkey.jpg'),
};

export function photoSource(photo: Photo, width = 1200): ImageSource | number {
  return (photo.local && LOCAL[photo.id]) || { uri: photoUrl(photo, width) };
}
