#!/usr/bin/env bash
# Usage: ./scripts/set-domain.sh yourdomain.com
# Replaces the placeholder domain (example.com) in the canonical tag, robots.txt and sitemap.
set -euo pipefail
if [ $# -ne 1 ]; then echo "Usage: $0 yourdomain.com"; exit 1; fi
DOMAIN="$1"
cd "$(dirname "$0")/../public"
for f in index.html robots.txt sitemap.xml 404.html; do
  [ -f "$f" ] && sed -i.bak "s/example\.com/${DOMAIN}/g" "$f" && rm -f "$f.bak"
done
echo "Domain set to ${DOMAIN}. Review index.html for the hello@${DOMAIN} contact address."
