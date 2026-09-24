# Releasing push-cli

## npm bootstrap and OIDC

npm requires the package to exist before a Trusted Publisher can be configured. After the first public GitHub Release is available, publish the matching initial version once from the release checkout:

```sh
npm publish --access public --tag alpha
```

Then, in npm package settings, add a GitHub Actions Trusted Publisher with owner `ybbapp`, repository `push-cli`, workflow filename `release.yml`, and permission to run `npm publish`. No npm token is stored in GitHub Actions. The workflow uses OIDC for later versions.

## Releases

Push a version tag to run `.github/workflows/release.yml`:

- `alpha-0.0.1` creates npm version `0.0.1-alpha.0`, publishes to the `alpha` dist-tag, and creates the matching GitHub Release and Docker tags.
- `v1.0.0` creates npm version `1.0.0`, publishes to the `latest` dist-tag, and creates the matching GitHub Release and Docker tags.

The release workflow builds macOS amd64/arm64, Linux amd64/arm64/riscv64, and Windows amd64/arm64 binaries. It adds a SHA-256 manifest to the GitHub Release and publishes Linux amd64/arm64/riscv64 images to GHCR.

If the npm package does not exist yet, the workflow skips npm publication while continuing the GitHub Release and GHCR jobs. On first GHCR publication, set the package visibility to Public in GitHub Packages so users can pull it anonymously.
