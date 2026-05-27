import { apiClient } from '../../api/client';

const avatarContentType = 'image/jpeg';
const maxAvatarBytes = 300 * 1024;

export async function pickAndUploadAvatar(token: string): Promise<null | string> {
  const { ImageManipulator, ImagePicker } = await loadAvatarNativeModules();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('需要允许访问相册，才能选择头像。');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.9,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const manipulatedImage = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { height: 256, width: 256 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const imageResponse = await fetch(manipulatedImage.uri);
  const imageBlob = await imageResponse.blob();

  if (imageBlob.size > maxAvatarBytes) {
    throw new Error('头像图片有点大，请换一张更轻的图片。');
  }

  const upload = await apiClient.createAvatarUpload(
    {
      contentLength: imageBlob.size,
      contentType: avatarContentType,
    },
    token,
  );
  const uploadResponse = await fetch(upload.uploadUrl, {
    body: imageBlob,
    headers: {
      'content-type': avatarContentType,
    },
    method: 'PUT',
  });

  if (!uploadResponse.ok) {
    throw new Error('头像上传失败，稍后再试。');
  }

  return upload.publicUrl;
}

async function loadAvatarNativeModules() {
  try {
    const [ImagePicker, ImageManipulator] = await Promise.all([
      import('expo-image-picker'),
      import('expo-image-manipulator'),
    ]);

    return {
      ImageManipulator,
      ImagePicker,
    };
  } catch (error) {
    throw new Error('头像功能需要重新构建开发包后才能使用。');
  }
}
