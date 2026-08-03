#!/bin/sh

set -e

echo "Bundling the module..."
# Get version number from argument (default to "latest" if not provided)
if [ -z "$1" ]; then
	echo "No version number provided. Using default: latest"
fi
VERSION_NUMBER="${1:-latest}"

rm -rf dist || echo 'No existing dist folder found.'
rm -f module.zip || echo 'No existing zip found.'
mkdir -p dist && echo 'Created dist folder.'

# Copy all necessary files
IGNORED=".git dist assets .gitignore"
for item in .[!.]* *; do
	[ "$item" = "." ] && continue
	[ "$item" = ".." ] && continue

	skip=false
	for ig in $IGNORED; do
		if [ "$item" = "$ig" ]; then
			skip=true
			break
		fi
	done
	[ "$skip" = true ] && continue

	cp -r -- "$item" dist/
done

# Patch module.json with new version number
sed -i "s/@VERSION/$VERSION_NUMBER/g" dist/module.json

# Zip the module for uploading
zip -r -9 module.zip dist
