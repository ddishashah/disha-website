#!/bin/bash
# Builds the whole site for Cloudflare Pages: the existing static pages + the blog, merged into ./dist
#   build command:  bash scripts/build.sh      output directory:  dist
set -euo pipefail
cd "$(dirname "$0")/.."

# local-preview links to the site (blog-app/scripts/link-site.sh) must not be built twice
find blog-app/public -maxdepth 1 -type l -delete 2>/dev/null || true
rm -rf dist && mkdir dist
# 1. the static site, exactly as it is in the repo
tar -cf - \
  --exclude='./.git' --exclude='./blog-app' --exclude='./functions' --exclude='./scripts' \
  --exclude='./node_modules' --exclude='./dist' --exclude='./wrangler.jsonc' --exclude='./.github' \
  --exclude='./package.json' --exclude='./package-lock.json' . | tar -xf - -C dist

# 2. the blog (Astro) on top
( cd blog-app && npm ci && npm run build )
cp -R blog-app/dist/. dist/

# 3. add the blog pages to the sitemap
python3 - <<'PY'
import glob, re
urls = ['https://disha-shah.io/blog/'] + sorted('https://disha-shah.io/' + p[len('dist/'):-len('index.html')] for p in glob.glob('dist/blog/*/index.html'))
s = open('dist/sitemap.xml').read()
add = ''.join('  <url><loc>%s</loc></url>\n' % u for u in urls if u not in s)
open('dist/sitemap.xml', 'w').write(s.replace('</urlset>', add + '</urlset>'))
PY

# 4. the editor's single-page app needs every /keystatic/... address to open the same page
printf '\n/keystatic/*  /keystatic/  200\n' >> dist/_redirects
echo "built: $(find dist -type f | wc -l) files"
