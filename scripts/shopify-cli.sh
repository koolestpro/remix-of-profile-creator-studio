#!/usr/bin/env bash
# Shopify theme pull/push using the Theme Access password.
#
# Run this from YOUR machine, not the sandbox — Shopify refuses API calls from
# the sandbox's IP, but your laptop authenticates fine.
#
#   ./scripts/shopify-cli.sh pull    # download the live theme
#   ./scripts/shopify-cli.sh push    # upload changes to a NEW unpublished theme
#   ./scripts/shopify-cli.sh push-to <themeId>   # upload to a specific theme
#
# Credentials come from .env.local, so nothing secret is typed on the command
# line (where it would land in your shell history).

set -euo pipefail
cd "$(dirname "$0")/.."

# --- credentials -----------------------------------------------------------
[ -f .env.local ] || { echo "✗ .env.local not found"; exit 1; }
STORE=$(grep -m1 '^SHOPIFY_STORE=' .env.local | cut -d= -f2- | tr -d '"'"'"' ')
TOKEN=$(grep -m1 '^SHOPIFY_THEME_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'"'"' ')
# Set once after the first push so later pushes update that theme in place.
# Without it every push creates another theme, and Shopify caps you at 20.
THEME_ID=$(grep -m1 '^SHOPIFY_THEME_ID=' .env.local | cut -d= -f2- | tr -d '"'"'"' ' || true)

[ -n "$STORE" ] || { echo "✗ SHOPIFY_STORE missing from .env.local"; exit 1; }
[ -n "$TOKEN" ] || { echo "✗ SHOPIFY_THEME_TOKEN missing from .env.local"; exit 1; }

export SHOPIFY_CLI_THEME_TOKEN="$TOKEN"
export SHOPIFY_FLAG_STORE="$STORE"

# --- CLI check -------------------------------------------------------------
if ! command -v shopify >/dev/null 2>&1; then
  echo "Shopify CLI not found. Install it with:"
  echo "    npm install -g @shopify/cli@latest"
  exit 1
fi

# Where the theme files live locally. Matches the folder already created.
THEME_DIR="tapandrate-store"

case "${1:-}" in
  pull)
    mkdir -p "$THEME_DIR"
    echo "Pulling live theme from $STORE into $THEME_DIR …"
    shopify theme pull --store "$STORE" --path "$THEME_DIR" --live
    echo
    echo "✓ Done. Tell Claude 'theme pulled' and it will make the changes."
    ;;

  push)
    [ -d "$THEME_DIR" ] || { echo "✗ No $THEME_DIR — run 'pull' first"; exit 1; }
    if [ -n "$THEME_ID" ]; then
      echo "Updating existing unpublished theme $THEME_ID (nothing customer-facing changes)…"
      shopify theme push --store "$STORE" --path "$THEME_DIR" --theme "$THEME_ID"
      echo
      echo "✓ Pushed. Preview:"
      echo "  https://$STORE?preview_theme_id=$THEME_ID"
    else
      echo "Pushing to a NEW unpublished theme (nothing customer-facing changes)…"
      shopify theme push --store "$STORE" --path "$THEME_DIR" --unpublished \
        --theme "Live + Google business lookup"
      echo
      echo "✓ Pushed. Add the new theme's id to .env.local as SHOPIFY_THEME_ID"
      echo "  so future pushes update it instead of creating another theme."
    fi
    echo "  When happy: Online Store → Themes → ⋯ → Publish"
    ;;

  push-to)
    [ -n "${2:-}" ] || { echo "✗ Usage: $0 push-to <themeId>"; exit 1; }
    shopify theme push --store "$STORE" --path "$THEME_DIR" --theme "$2"
    ;;

  *)
    echo "Usage: $0 {pull|push|push-to <themeId>}"
    exit 1
    ;;
esac
