#!/bin/sh

set -e
SCRIPT_DIR="$(dirname "$0")"

echo "Preparing release artifacts..."
# Get version number from argument (default to "latest" if not provided)
if [ -z "$1" ]; then
	echo "No version number provided."
	exit 1
fi
VERSION_NUMBER="${1:-latest}"

echo "Bundle release"
sh "$SCRIPT_DIR/bundle.sh" "$VERSION_NUMBER"

echo "Preparing release notes..."
LOG_FORMAT="- %s (%h) by %cN"
PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$PREVIOUS_TAG" ]; then
	COMMITS=$(git log --pretty=format:"$LOG_FORMAT")
else
	COMMITS=$(git log "$PREVIOUS_TAG..HEAD" --pretty=format:"$LOG_FORMAT")
fi
echo "$COMMITS" >commits.md

(
	echo "# ${VERSION_NUMBER}"
	echo ""
	echo "## Changes"
	echo ""
	cat commits.md
) >release_notes.md

echo "Creating annotated tag..."
git tag "$VERSION_NUMBER" -m "$(cat release_notes.md)"
git push && git push --tags

echo "Creating GitHub release"
RELEASE_URL=$(gh release create "$VERSION_NUMBER" \
	--latest \
	--title "$VERSION_NUMBER" \
	--notes-file release_notes.md \
	module.zip \
	dist/module.json)
echo "Created: $RELEASE_URL"

echo "Updating FoundryVTT Module submission"
jq \
	--arg version "$VERSION_NUMBER" \
	--arg manifest "https://github.com/HectorCastelli/fvtt-player-spotlight/releases/download/$VERSION_NUMBER/module.json" \
	--arg notes "$RELEASE_URL" \
	'. as $m |
  {
    id: .id,
    release: {
      version: $version,
      manifest: $manifest,
      notes: $notes,
      compatibility: .compatibility
    }
  }
' "dist/module.json" >foundry-payload.json

if [ -z "$FOUNDRY_API_TOKEN" ]; then
	echo 'Unable to find FOUNDRY_API_TOKEN. FoundryVTT submission was not updated.'
	exit 2
fi

curl -X POST "https://foundryvtt.com/_api/packages/release_version/" \
	-H "Content-Type: application/json" \
	-H "Authorization: $FOUNDRY_API_TOKEN" \
	-d @foundry-payload.json
