#!/bin/bash
set -euo pipefail

# Deploy the Async Challenge link domain (ADR-0003) — the static AASA / assetlinks /
# fallback page — to the showdown.lebene.pl subdomain on seohost.
#
# A mandatory pre-flight guard (see preflight()) runs before any upload and aborts
# on anything that would publish a broken or wrong-target deploy. Driven by the
# `deploy-challenge-domain` skill.
#
# Usage:
#   scripts/deploy-challenge-domain.sh             # preflight -> rsync -> perms -> verify
#   scripts/deploy-challenge-domain.sh --preflight # safety guard only (no upload)
#   scripts/deploy-challenge-domain.sh --verify    # live header check only (no upload)

HOST="h69.seohost.pl"
IP="185.200.44.3"
USER="srv99920"
PORT="57185"
DOMAIN="showdown.lebene.pl"
REMOTE_DIR="domains/$DOMAIN/public_html"

# Expected identity baked into the link files — the guard refuses to publish if these drift.
EXPECTED_APPID="RA73B8WWF4.com.showdown.app"
EXPECTED_PKG="com.showdown.app"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$SCRIPT_DIR/../static/challenge-domain"
AASA="$LOCAL_DIR/.well-known/apple-app-site-association"
ASSETLINKS="$LOCAL_DIR/.well-known/assetlinks.json"
INDEX="$LOCAL_DIR/index.html"
HTACCESS="$LOCAL_DIR/.htaccess"

red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
grn() { printf '\033[0;32m%s\033[0m\n' "$1"; }
ylw() { printf '\033[1;33m%s\033[0m\n' "$1"; }

json_ok() {
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$1" 2>/dev/null
    elif command -v node >/dev/null 2>&1; then
        node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$1" 2>/dev/null
    else
        return 2 # no validator available
    fi
}

# Pre-flight safety guard. BLOCK (return 1) on anything that would publish a broken
# or wrong-target deploy; WARN on known-pending-but-safe states (e.g. unfilled
# Android SHAs). Always runs before an upload.
preflight() {
    local blocked=0
    echo "Pre-flight safety checks:"

    # Required files present
    for f in "$AASA" "$ASSETLINKS" "$INDEX" "$HTACCESS"; do
        [[ -f "$f" ]] || { red "  BLOCK: missing $(basename "$f")"; blocked=1; }
    done

    # Valid JSON (AASA has no extension but must parse as JSON)
    for f in "$AASA" "$ASSETLINKS"; do
        if [[ -f "$f" ]]; then
            json_ok "$f"
            case $? in
                0) ;;
                2) ylw "  WARN: no python3/node to validate JSON in $(basename "$f")" ;;
                *) red "  BLOCK: invalid JSON in $(basename "$f")"; blocked=1 ;;
            esac
        fi
    done

    # AASA must carry the real appID and no leftover placeholder
    if [[ -f "$AASA" ]]; then
        grep -q "REPLACE_WITH" "$AASA" && { red "  BLOCK: AASA still has a REPLACE_WITH placeholder"; blocked=1; }
        grep -q "$EXPECTED_APPID" "$AASA" || { red "  BLOCK: AASA missing expected appID $EXPECTED_APPID"; blocked=1; }
    fi

    # assetlinks must target the right package
    if [[ -f "$ASSETLINKS" ]]; then
        grep -q "$EXPECTED_PKG" "$ASSETLINKS" || { red "  BLOCK: assetlinks missing package $EXPECTED_PKG"; blocked=1; }
    fi

    # Never target the main lebene.pl site by accident
    if [[ "$REMOTE_DIR" != "domains/$DOMAIN/public_html" ]]; then
        red "  BLOCK: REMOTE_DIR '$REMOTE_DIR' is not the $DOMAIN subdomain docroot"; blocked=1
    fi

    # WARNs — safe to deploy, but surface the known-pending bits
    if [[ -f "$ASSETLINKS" ]] && grep -Eq "REPLACE_WITH.*SHA256" "$ASSETLINKS"; then
        ylw "  WARN: assetlinks has SHA-256 placeholders — Android App Links will NOT verify yet"
    fi
    if [[ -f "$INDEX" ]] && grep -q "REPLACE_WITH_APP_STORE_URL" "$INDEX"; then
        ylw "  WARN: index.html App Store URL is still a placeholder (fallback page only, non-blocking)"
    fi

    if [[ "$blocked" -ne 0 ]]; then
        red "Pre-flight FAILED — refusing to deploy."
        return 1
    fi
    grn "Pre-flight passed."
}

verify() {
    echo "== DNS (authoritative ns1.seohost.pl) =="
    dig +short "$DOMAIN" @ns1.seohost.pl || true
    echo "== DNS (public resolver — blank until propagated) =="
    dig +short "$DOMAIN" || true
    # --resolve hits the server directly, so verification works before public DNS
    # propagation. Apple requires the AASA over HTTPS: 200, application/json, no redirect.
    echo "== apple-app-site-association (HTTPS) =="
    curl -sI --resolve "$DOMAIN:443:$IP" "https://$DOMAIN/.well-known/apple-app-site-association" \
        | grep -iE "HTTP/|content-type|location" || true
    echo "== assetlinks.json (HTTPS) =="
    curl -sI --resolve "$DOMAIN:443:$IP" "https://$DOMAIN/.well-known/assetlinks.json" \
        | grep -iE "HTTP/|content-type" || true
}

case "${1:-}" in
    --preflight)
        preflight
        exit $?
        ;;
    --verify)
        verify
        exit 0
        ;;
esac

preflight || exit 1

echo
echo "Deploying $LOCAL_DIR -> $USER@$HOST:$REMOTE_DIR"
rsync -avz -e "ssh -p $PORT" \
    --exclude 'README.md' \
    --exclude '.DS_Store' \
    "$LOCAL_DIR/" "$USER@$HOST:$REMOTE_DIR/"

echo "Setting permissions (dirs 755, files 644)..."
ssh -p "$PORT" "$USER@$HOST" \
    "cd $REMOTE_DIR && find . -type d -exec chmod 755 {} \\; && find . -type f -exec chmod 644 {} \\;"

echo
verify
echo
grn "Done. Once public DNS propagates, https://$DOMAIN/.well-known/* is live."
