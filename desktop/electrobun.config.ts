import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectrobunConfig } from 'electrobun/bun';

/**
 * Require an environment variable for production builds.
 * Prevents signing with placeholder credentials.
 */
function requireSigningEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for code signing. ` +
      `Set ${name} in CI secrets or disable signing by unsetting ELECTROBUN_BUILD_ENV.`,
    );
  }
  return value;
}

const isStableBuild = process.env['ELECTROBUN_BUILD_ENV'] === 'stable';

type ExtendedElectrobunConfig = ElectrobunConfig & {
  app: ElectrobunConfig['app'] & {
    // Electrobun does not type document associations yet, but we keep the
    // metadata here so packaging can pick it up as support lands.
    fileAssociations?: Array<{
      name: string;
      extensions: string[];
      mimeType?: string;
      role?: 'viewer' | 'editor';
    }>;
  };
  packaging?: {
    windowsInstaller?: {
      mode: 'nsis';
      perMachine: boolean;
    };
    linuxDeb?: {
      category: string;
      maintainer: string;
    };
  };
  signing?: {
    mac: {
      teamId: string;
      certificateName: string;
      appleId: string;
      appSpecificPassword: string;
    };
    win: {
      certificateSubject: string;
      timestampServer: string;
    };
  };
};

const desktopPackageJson = JSON.parse(
  readFileSync(join(import.meta.dir, 'package.json'), 'utf8'),
) as { version: string };
const releaseBaseUrl =
  process.env['CONIVA_RELEASE_BASE_URL'] ?? 'https://updates.coniva.app/releases';
const updateEndpoint =
  process.env['CONIVA_UPDATE_ENDPOINT'] ?? `${releaseBaseUrl.replace(/\/+$/, '')}/latest.json`;

const config: ExtendedElectrobunConfig = {
  app: {
    name: 'Coniva',
    identifier: 'com.coniva.app',
    version: desktopPackageJson.version,
    description: 'Desktop shell for the Coniva icon authoring studio.',
    fileAssociations: [
      {
        name: 'Coniva Project',
        extensions: ['coniva.json'],
        mimeType: 'application/json',
        role: 'editor',
      },
    ],
  },
  build: {
    bun: {
      entrypoint: 'src/bun/index.ts',
    },
    views: {
      mainview: {
        entrypoint: 'src/mainview/index.ts',
      },
    },
    copy: {
      '.generated/mainview': 'app/views/mainview',
    },
    targets: process.env['ELECTROBUN_BUILD_ENV'] === 'stable' ? 'all' : 'current',
    mac: {
      codesign: Boolean(process.env['APPLE_DEVELOPER_IDENTITY']),
      notarize: Boolean(process.env['APPLE_NOTARIZATION_APPLE_ID']),
      entitlements: {},
    },
    win: {
      defaultRenderer: 'native',
    },
    linux: {
      defaultRenderer: 'native',
    },
  },
  runtime: {
    updateEndpoint,
  },
  release: {
    baseUrl: releaseBaseUrl,
    generatePatch: true,
  },
  packaging: {
    windowsInstaller: {
      mode: 'nsis',
      perMachine: false,
    },
    linuxDeb: {
      category: 'Graphics',
      maintainer: 'Coniva Team <desktop@coniva.app>',
    },
  },
  signing: isStableBuild
    ? {
        mac: {
          teamId: requireSigningEnv('APPLE_TEAM_ID'),
          certificateName: requireSigningEnv('APPLE_DEVELOPER_IDENTITY'),
          appleId: requireSigningEnv('APPLE_NOTARIZATION_APPLE_ID'),
          appSpecificPassword: requireSigningEnv('APPLE_NOTARIZATION_PASSWORD'),
        },
        win: {
          certificateSubject: requireSigningEnv('WINDOWS_CERT_SUBJECT'),
          timestampServer:
            process.env['WINDOWS_TIMESTAMP_SERVER'] ?? 'https://timestamp.digicert.com',
        },
      }
    : undefined,
};

export default config;
