#!/bin/sh
# Rebuild every brand output, in dependency order. Run from anywhere.
#   brand/tools/build.sh            # tokens, icons, logo, preview
#   brand/tools/build.sh --shots D  # and screenshot the preview into D
# The wordmark outlines (logo/src/wordmark.json) are committed and are NOT
# rebuilt here: run build_wordmark.py only when changing the wordmark.
set -e
cd "$(dirname "$0")/../.."
python3 brand/tools/build_tokens.py --check >/dev/null
node brand/tools/render.mjs
node brand/tools/preview.mjs "$@"
