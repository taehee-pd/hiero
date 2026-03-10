import { describe, expect, test } from 'bun:test';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';
import packageManifestFixture from './fixtures/compiler-contracts/package-manifest.json';
import iconChangeRecordFixture from './fixtures/compiler-contracts/icon-change-record.json';
import {
  COMPILED_ICON_SCHEMA_URI,
  ICON_CHANGE_RECORD_SCHEMA_URI,
  PACKAGE_MANIFEST_SCHEMA_URI,
  isCompiledIcon,
  isIconChangeRecord,
  isPackageManifest,
} from '../lib/compiler-contracts';

describe('compiler contracts fixtures', () => {
  test('compiled icon fixture validates', () => {
    expect(compiledIconFixture.$schema).toBe(COMPILED_ICON_SCHEMA_URI);
    expect(isCompiledIcon(compiledIconFixture)).toBeTrue();
  });

  test('package manifest fixture validates', () => {
    expect(packageManifestFixture.$schema).toBe(PACKAGE_MANIFEST_SCHEMA_URI);
    expect(isPackageManifest(packageManifestFixture)).toBeTrue();
  });

  test('icon change record fixture validates', () => {
    expect(iconChangeRecordFixture.$schema).toBe(ICON_CHANGE_RECORD_SCHEMA_URI);
    expect(isIconChangeRecord(iconChangeRecordFixture)).toBeTrue();
  });
});
