import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export async function choosePhoto(camera, rc) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access in your phone settings, or choose a photo.');
  }
  const result = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: rc ? 1 : 0.85 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const max = (rc ? 8 : 5) * 1024 * 1024;
  if (asset.fileSize > max) throw new Error(`Choose an image smaller than ${rc ? 8 : 5} MB.`);
  const type = asset.mimeType || (/\.png$/i.test(asset.uri) ? 'image/png' : 'image/jpeg');
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) throw new Error('Choose a JPG, PNG or WEBP photo.');
  return { ...asset, mimeType: type };
}
export async function upload(path, field, asset, fields = {}) {
  const blob = Platform.OS === 'web' ? await (await fetch(asset.uri)).blob() : null;
  return api.upload(path, () => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    const name = asset.fileName || `photo.${asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
    if (blob) form.append(field, blob, name);
    else form.append(field, { uri: asset.uri, type: asset.mimeType, name });
    return form;
  });
}
