#!/usr/bin/env node
/**
 * Give every SARIF result a concrete artifact location.
 *
 * Grype builds each result's physicalLocation.artifactLocation from the scan
 * source's file paths. When the source is a CycloneDX SBOM there are no paths
 * -- cyclonedx-npm records no evidence.occurrences -- so results arrive with
 * empty locations and GitHub code scanning rejects the whole file with
 * "locationFromSarifResult: expected artifact location".
 *
 * Every finding is a dependency of the manifest, so anchor location-less
 * results to the lockfile. That is where a reader would go to act on them.
 *
 * Usage: node scripts/normalize-sarif-locations.mjs <sarif-file> [anchor-path]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [sarifPath, anchorPath = 'package-lock.json'] = process.argv.slice(2);

if (!sarifPath) {
  console.error('usage: normalize-sarif-locations.mjs <sarif-file> [anchor-path]');
  process.exit(2);
}

const sarif = JSON.parse(readFileSync(sarifPath, 'utf8'));

/** A location is only usable by code scanning if it resolves to a URI. */
const hasArtifactUri = (location) =>
  typeof location?.physicalLocation?.artifactLocation?.uri === 'string' &&
  location.physicalLocation.artifactLocation.uri.length > 0;

const anchor = () => ({
  physicalLocation: {
    artifactLocation: { uri: anchorPath },
    // code scanning requires a region; the lockfile has no meaningful line.
    region: { startLine: 1 },
  },
});

let patched = 0;
let total = 0;

for (const run of sarif.runs ?? []) {
  for (const result of run.results ?? []) {
    total += 1;
    const usable = (result.locations ?? []).filter(hasArtifactUri);

    if (usable.length === 0) {
      result.locations = [anchor()];
      patched += 1;
    } else if (usable.length !== result.locations.length) {
      // Drop the unusable siblings; one bad entry rejects the upload.
      result.locations = usable;
      patched += 1;
    }
  }
}

writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
console.log(
  `normalize-sarif-locations: anchored ${patched} of ${total} result(s) to ${anchorPath}`,
);
