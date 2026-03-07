#!/bin/bash
# Sync images from content/ to public/ for Next.js static serving.
# Run automatically via predev/prebuild scripts.

set -e

CONTENT_DIR="content"
PUBLIC_DIR="public"

# Clean and copy per-presentation images
for dir in "$CONTENT_DIR"/*/; do
  slug=$(basename "$dir")
  [ "$slug" = "shared" ] && continue
  rm -rf "$PUBLIC_DIR/$slug" 2>/dev/null || true
  if [ -d "$dir/images" ]; then
    mkdir -p "$PUBLIC_DIR/$slug"
    cp -r "$dir/images/"* "$PUBLIC_DIR/$slug/" 2>/dev/null || true
  fi
  # Copy per-presentation CSS files (e.g. animations.css)
  for css in "$dir"*.css; do
    [ -f "$css" ] || continue
    mkdir -p "$PUBLIC_DIR/$slug"
    cp "$css" "$PUBLIC_DIR/$slug/" 2>/dev/null || true
  done
done

# Clean and copy shared images
rm -rf "$PUBLIC_DIR/shared" 2>/dev/null || true
if [ -d "$CONTENT_DIR/shared/images" ]; then
  mkdir -p "$PUBLIC_DIR/shared"
  cp -r "$CONTENT_DIR/shared/images/"* "$PUBLIC_DIR/shared/" 2>/dev/null || true
fi

echo "Synced content images to public/"
