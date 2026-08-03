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
PREVIOUS_TAG=$(git describe --tags --abbrev=0 "HEAD^" 2>/dev/null || echo "")
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
git push --tags

echo "Creating draft release"
gh release create "$VERSION_NUMBER" \
	--draft \
	--title "$VERSION_NUMBER" \
	--notes-from-tag \
	module.zip \
	dist/module.json
