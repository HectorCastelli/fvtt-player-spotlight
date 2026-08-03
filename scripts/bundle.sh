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
NEEDED="lang src styles module.json README.md UNLICENSE"
for item in .[!.]* *; do
	[ "$item" = "." ] && continue
	[ "$item" = ".." ] && continue

	need=false
	for ig in $NEEDED; do
		if [ "$item" = "$ig" ]; then
			need=true
			break
		fi
	done
	[ "$need" = false ] && continue

	cp -r -- "$item" dist/
done

# Patch module.json with new version number
sed -i "s/@VERSION/$VERSION_NUMBER/g" dist/module.json

# Zip the module for uploading
(
	cd dist
	zip -r -9 ../module.zip .
)
