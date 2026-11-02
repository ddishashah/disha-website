#!/bin/bash
# For local preview only: lets the blog dev server serve the main site's fonts, images and scripts.
# (On the live build the blog is merged into the full site, so these already exist.)
cd "$(dirname "$0")/.." || exit 1
for f in fonts img gallery logos icons video work arc.js compact.css favicon.ico favicon-32.png apple-touch-icon.png icon-192.png icon-512.png; do
  [ -e "../$f" ] && [ ! -e "public/$f" ] && ln -s "../../$f" "public/$f"
done
echo "linked"
