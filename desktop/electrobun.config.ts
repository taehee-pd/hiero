import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectrobunConfig } from 'electrobun/bun';

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
  process.env['ICOPHONE_RELEASE_BASE_URL'] ?? 'https://updates.icophone.app/releases';
const updateEndpoint =
  process.env['ICOPHONE_UPDATE_ENDPOINT'] ?? `${releaseBaseUrl.replace(/\/+$/, '')}/latest.json`;

const config: ExtendedElectrobunConfig = {
  app: {
    name: 'Icophone',
    identifier: 'com.icophone.app',
    version: desktopPackageJson.version,
    description: 'Desktop shell for the Icophone icon authoring studio.',
    fileAssociations: [
      {
        name: 'Icophone Project',
        extensions: ['icophone.json'],
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
    targets: 'all',
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
      maintainer: 'Icophone Team <desktop@icophone.app>',
    },
  },
  signing: {
    mac: {
      teamId: process.env['APPLE_TEAM_ID'] ?? 'TEAMID1234',
      certificateName:
        process.env['APPLE_DEVELOPER_IDENTITY'] ?? 'Developer ID Application: Example, Inc. (TEAMID1234)',
      appleId: process.env['APPLE_NOTARIZATION_APPLE_ID'] ?? 'developer@example.com',
      appSpecificPassword: process.env['APPLE_NOTARIZATION_PASSWORD'] ?? 'app-specific-password',
    },
    win: {
      certificateSubject: process.env['WINDOWS_CERT_SUBJECT'] ?? 'CN=Icophone Desktop',
      timestampServer:
        process.env['WINDOWS_TIMESTAMP_SERVER'] ?? 'http://timestamp.digicert.com',
    },
  },
};

export default config;
