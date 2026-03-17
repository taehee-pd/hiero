# Sync Troubleshooting Guide

Troubleshooting reference for administrators and users encountering issues with the GitHub PR sync pipeline.

## Auth Expired / Invalid Token

**Symptom:** Sync returns `AUTH_FAILURE` (HTTP 401) or conflict kind `auth-expired`.

**Causes:**
- `GITHUB_SYNC_TOKEN` environment variable is missing or empty on the server.
- Token has been revoked or has expired.
- Token was generated for a different GitHub account.

**Resolution:**
1. Verify the token is set: the server should have `GITHUB_SYNC_TOKEN` in its environment.
2. Generate a new fine-grained Personal Access Token on GitHub:
   - Scope to the specific target repository.
   - Grant **Contents: Read and write** and **Pull requests: Read and write**.
3. Update the environment variable and restart the server.
4. If using a GitHub App installation token, verify the app is still installed on the repo and the token hasn't expired (they rotate hourly by default).

**Token format hints:**
| Prefix | Type | Notes |
|--------|------|-------|
| `github_pat_` | Fine-grained PAT | Recommended. Can be scoped to single repos. |
| `ghp_` | Classic PAT | Requires broad `repo` scope. Use fine-grained instead. |
| `ghs_` | GitHub App installation | Auto-expires. Must be refreshed via app API. |
| `gho_` | OAuth token | Requires `repo` scope on the OAuth app. |

---

## Insufficient Repository Permission

**Symptom:** Sync returns `REPO_PERMISSION_FAILURE` (HTTP 403).

**Causes:**
- Token lacks write access to the repository contents or pull requests.
- Repository requires admin approval for new collaborators or apps.
- Organization has IP allow-list or SSO requirements that the token doesn't satisfy.

**Resolution:**
1. Check the token's permission scopes on GitHub (Settings > Developer settings > Personal access tokens).
2. Required permissions:
   - **Contents:** Read and write (branches, files, trees)
   - **Pull requests:** Read and write (create PRs)
   - **Metadata:** Read (implicit, always granted)
3. If the repo is in an organization with SSO, authorize the token for SSO via "Configure SSO" on the token settings page.
4. If using a GitHub App, verify the app has the correct repository permissions and is installed on the target repo.

---

## Protected Branch Expectations

**Symptom:** Branch creation succeeds but the PR merge is blocked.

**Background:** The sync pipeline creates a *feature branch* and opens a PR — it never pushes directly to the base branch. This design is intentionally compatible with branch protection rules.

**Expected configuration on the base branch:**
- **Require pull request reviews:** The sync PR will need at least one approving review before merge. This is the recommended setup.
- **Require status checks to pass:** CI validation (source export check, compile dry-run) should be configured as required status checks so invalid icon changes cannot merge.
- **Restrict who can push:** Does not affect sync because it only creates branches (not direct pushes to the protected branch). However, the token's user/app must be allowed to create branches.
- **Require signed commits:** If enabled, the token's associated account or GitHub App must have commit signing configured. The Contents API does not produce GPG-signed commits by default.

**If the sync PR cannot be merged:**
1. Check the branch protection rules on the base branch (Settings > Branches > Branch protection rules).
2. Ensure required status checks are passing in CI.
3. Ensure at least one reviewer has approved if reviews are required.
4. If signed commits are required, consider switching to a GitHub App (which signs commits automatically) or disabling that specific rule.

---

## CI Failing on PR Validation

**Symptom:** The `icons-pr-validate` workflow fails on sync PRs.

**Common failure modes:**

### Schema validation failure
- **Cause:** Source files don't match the expected `IconSourceFile` or `SyncSourceManifest` schema.
- **Resolution:** Check the `validate-source-export` step output. Schema errors list the specific field and file that failed. Re-export from the editor to regenerate compliant files.

### Compile pipeline failure
- **Cause:** Source files are structurally valid but the compiler cannot produce runtime output (e.g., missing required fields, malformed SVG paths).
- **Resolution:** Check the `compile-from-source` dry-run step. The error will indicate which icon failed to compile. Fix the icon in the editor and re-sync.

### Conflicting input sources
- **Cause:** A `project.json` file exists alongside the source export files. The guardrail in `source-of-truth.ts` rejects this ambiguity.
- **Resolution:** Remove the `project.json` from the repository. Canonical builds should only use source export files.

### Artifact upload failure
- **Cause:** CI couldn't upload preview SVGs or the dry-run package.
- **Resolution:** This is usually a transient GitHub Actions issue. Re-run the workflow. If persistent, check artifact storage quotas.

### Test failures
- **Cause:** The sync added or modified test fixtures that break existing tests.
- **Resolution:** Check the test output for specific assertion failures. The sync pipeline itself doesn't modify test files, so this usually indicates a pre-existing test issue on the base branch.

---

## Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_FAILURE` | 401 | Token missing, invalid, or expired |
| `REPO_PERMISSION_FAILURE` | 403 | Token lacks required repository permissions |
| `BRANCH_CREATION_FAILURE` | 502 | Could not create the feature branch |
| `FILE_WRITE_FAILURE` | 502 | Could not write a file to the branch |
| `FILE_DELETE_FAILURE` | 502 | Could not delete a file from the branch |
| `PR_CREATION_FAILURE` | 502 | Could not create the pull request |
| `VALIDATION_FAILURE` | 400 | Request payload failed schema validation |
| `CONFLICT_DETECTED` | 409 | Optimistic concurrency conflict detected |
| `PROVIDER_ERROR` | 502 | Unclassified git provider failure |

## Conflict Error Codes

| Code | Conflict Kind | Meaning |
|------|---------------|---------|
| `STALE_BASE_REVISION` | base-sha-drift | Base branch moved since your export |
| `ICON_CHANGED_REMOTELY` | icon-changed-remotely | Same icon was modified on the remote |
| `ICON_DELETED_REMOTELY` | icon-deleted-remotely | Icon was deleted on the remote |
| `MANIFEST_CONFLICT` | manifest-changed-remotely | manifest.json modified externally |
| `BRANCH_NAME_COLLISION` | branch-already-exists | Target branch name already taken |
| `AUTH_TOKEN_EXPIRED` | auth-expired | Token expired during conflict check |

---

## Feature Flag Overrides

The sync API respects environment-variable-based feature flags for rollout control:

| Variable | Default | Effect |
|----------|---------|--------|
| `SYNC_ENABLED` | `true` | Master kill switch. Set to `false` to return 503 for all sync requests. |
| `SYNC_DRY_RUN_ONLY` | `false` | When `true`, validates payloads but does not create branches/PRs. |
| `SYNC_MAX_FILES` | `500` | Maximum files per sync request. Prevents runaway payloads. |
| `SYNC_ALLOWED_REPOS` | `""` (all) | Comma-separated `owner/repo` allow-list. Empty = all repos. |
| `SYNC_PREFLIGHT_CHECK` | `true` | Run a read-only permission check before every sync. |

To disable sync during an incident:
```bash
SYNC_ENABLED=false
```

To restrict sync to a staging repo during rollout:
```bash
SYNC_ALLOWED_REPOS=myorg/icons-staging
```
