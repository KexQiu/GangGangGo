import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

function expectVersion(actual, expected, source) {
  if (actual !== expected) {
    throw new Error(`${source} uses version ${actual ?? '<missing>'}; expected ${expected}.`);
  }
}

function extractVersion(source, pattern, sourceName) {
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Could not read the version from ${sourceName}.`);
  }
  return match[1];
}

const rootPackage = await readJson('package.json');
const expectedVersion = rootPackage.version;
if (typeof expectedVersion !== 'string' || expectedVersion.length === 0) {
  throw new Error('package.json must define a non-empty version.');
}

const packageFiles = [
  'apps/api/package.json',
  'apps/mobile/package.json',
  'apps/mobile/modules/live-activity/package.json',
  'apps/mobile/modules/storage-protection/package.json',
  'apps/mobile/modules/watch-connectivity/package.json',
  'packages/contracts/package.json',
];

for (const packageFile of packageFiles) {
  const packageJson = await readJson(packageFile);
  expectVersion(packageJson.version, expectedVersion, packageFile);
}

const podspecFiles = [
  'apps/mobile/modules/live-activity/ios/GangGangGoLiveActivity.podspec',
  'apps/mobile/modules/storage-protection/ios/GangGangGoStorageProtection.podspec',
  'apps/mobile/modules/watch-connectivity/ios/GangGangGoWatchConnectivity.podspec',
];

for (const podspecFile of podspecFiles) {
  const podspec = await read(podspecFile);
  expectVersion(extractVersion(podspec, /s\.version\s*=\s*'([^']+)'/, podspecFile), expectedVersion, podspecFile);
}

const appJson = await readJson('apps/mobile/app.json');
expectVersion(appJson.expo?.version, expectedVersion, 'apps/mobile/app.json expo.version');

const appConfig = await read('apps/mobile/app.config.ts');
expectVersion(
  extractVersion(appConfig, /version:\s*'([^']+)'/, 'apps/mobile/app.config.ts'),
  expectedVersion,
  'apps/mobile/app.config.ts',
);

const apiVersionSource = await read('apps/api/src/config/version.ts');
expectVersion(
  extractVersion(apiVersionSource, /apiVersion\s*=\s*'([^']+)'/, 'apps/api/src/config/version.ts'),
  expectedVersion,
  'apps/api/src/config/version.ts',
);

const openApiSource = await read('apps/api/src/app/openapiDocument.ts');
if (!/version:\s*apiVersion/.test(openApiSource)) {
  throw new Error('OpenAPI must use the shared apiVersion constant.');
}

const projectSource = await read('apps/mobile/ios/app.xcodeproj/project.pbxproj');
const marketingVersions = [...projectSource.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
if (marketingVersions.length === 0) {
  throw new Error('No Xcode MARKETING_VERSION settings were found.');
}
for (const marketingVersion of marketingVersions) {
  expectVersion(marketingVersion, expectedVersion, 'apps/mobile/ios/app.xcodeproj/project.pbxproj');
}

const plistFiles = [
  'apps/mobile/ios/app/Info.plist',
  'apps/mobile/ios/XiaoTiduLiveActivities/Info.plist',
  'apps/mobile/ios/XiaoTiduWatchApp/Info.plist',
  'apps/mobile/ios/XiaoTiduWatchComplications/Info.plist',
];

for (const plistFile of plistFiles) {
  const plist = await read(plistFile);
  const shortVersion = extractVersion(
    plist,
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
    plistFile,
  );
  expectVersion(shortVersion, '$(MARKETING_VERSION)', plistFile);
}

process.stdout.write(`All application and package versions match ${expectedVersion}.\n`);
