# npm registry 403: root cause and fix

In this environment, outbound HTTPS goes through a proxy (`http://proxy:8080`).
That proxy is currently rejecting CONNECT requests to public package registries with `403 Forbidden`.

## Evidence

- `curl -I https://registry.npmjs.org/shadcn` returns `CONNECT tunnel failed, response 403`.
- Without proxy, direct access also fails (`Couldn't connect to server`).

So this is **network policy**, not a package.json issue.

## Fix options

1. **Preferred (org-managed):** allowlist npm registry domains in proxy policy
   - `registry.npmjs.org`
   - `registry.yarnpkg.com` (optional)
   - any additional registry host you use

2. **Use an internal registry mirror** (Artifactory/Nexus/Verdaccio) and configure npm:

```bash
npm config set registry "https://<internal-registry-host>/"
```

or project-local in `.npmrc`:

```ini
registry=https://<internal-registry-host>/
```

3. **Run with direct egress** (no proxy) only if your network permits direct outbound TLS.

## Quick verification

```bash
npm ping
npm view react version
npx shadcn@latest --help
```

All should succeed once network/proxy is fixed.
