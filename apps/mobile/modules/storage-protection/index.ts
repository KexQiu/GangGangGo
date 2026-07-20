import { requireOptionalNativeModule } from 'expo-modules-core';

type StorageProtectionNativeModule = {
  protectSQLiteFiles: (directory: string, databaseName: string) => Promise<void>;
};

export default requireOptionalNativeModule<StorageProtectionNativeModule>('GangGangGoStorageProtection');
