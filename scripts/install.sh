#!/bin/sh

set -e

echo "Installing the module..."

# Get foundry instance path from argument
if [ -z "$1" ]; then
	echo "Error: No foundry data path provided."
	exit 1
fi
FOUNDRY_DATA_PATH="$1"

# Symlink module to the foundry instance
TARGET_PATH="$FOUNDRY_DATA_PATH/modules/fvtt-player-spotlight"

if [ -L "$TARGET_PATH" ]; then
	echo "Module already installed. Skipping installation."
else
	ln -s "$(pwd)" "$TARGET_PATH"
	echo "Module installed successfully."
fi
