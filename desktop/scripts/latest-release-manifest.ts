export type LatestReleaseManifest = {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  platforms: Record<
    string,
    {
      downloadUrl: string | null;
      files: string[];
    }
  >;
};

export function validateLatestReleaseManifest(value: unknown): LatestReleaseManifest {
  if (!isObject(value)) {
    throw new Error('latest.json must be a JSON object.');
  }

  assertString(value.version, 'version');
  assertIsoDate(value.releaseDate, 'releaseDate');
  assertString(value.releaseNotes, 'releaseNotes');
  assertObjectRecord(value.platforms, 'platforms');

  for (const [platformName, platformValue] of Object.entries(value.platforms)) {
    if (!platformName.trim()) {
      throw new Error('latest.json platform names must not be empty.');
    }

    if (!isObject(platformValue)) {
      throw new Error(`latest.json platform "${platformName}" must be an object.`);
    }

    if (
      !(
        typeof platformValue.downloadUrl === 'string' ||
        platformValue.downloadUrl === null
      )
    ) {
      throw new Error(
        `latest.json platform "${platformName}" downloadUrl must be a string or null.`,
      );
    }

    if (typeof platformValue.downloadUrl === 'string') {
      assertValidUrl(platformValue.downloadUrl, `platforms.${platformName}.downloadUrl`);
    }

    if (!Array.isArray(platformValue.files)) {
      throw new Error(`latest.json platform "${platformName}" files must be an array.`);
    }

    platformValue.files.forEach((file, index) => {
      if (typeof file !== 'string' || !file.trim()) {
        throw new Error(
          `latest.json platform "${platformName}" files[${index}] must be a non-empty string.`,
        );
      }
    });
  }

  return value as LatestReleaseManifest;
}

function assertString(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`latest.json ${fieldName} must be a non-empty string.`);
  }
}

function assertIsoDate(value: unknown, fieldName: string) {
  assertString(value, fieldName);

  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`latest.json ${fieldName} must be an ISO-8601 UTC timestamp.`);
  }
}

function assertObjectRecord(value: unknown, fieldName: string) {
  if (!isObject(value)) {
    throw new Error(`latest.json ${fieldName} must be an object.`);
  }
}

function assertValidUrl(value: string, fieldName: string) {
  try {
    // The update manifest publishes absolute download links.
    new URL(value);
  } catch {
    throw new Error(`latest.json ${fieldName} must be an absolute URL.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
