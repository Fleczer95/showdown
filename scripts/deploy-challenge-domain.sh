#!/bin/bash
set -euo pipefail

# Deploy the Async Challenge link domain (ADR-0003) — the static AASA / assetlinks /
# fallback page — to the showdown.lebene.pl subdomain on seohost.
#
# DNS for lebene.pl is delegated to seohost's nameservers, so the subdomain's own
# docroot is created in the seohost panel (Domyślnie → /domains/showdown.lebene.pl/
# public_html) and we just rsync files into it. Auth is the same key-based SSH used
# by the sibling lebene site deploy.
#
# Usage:
#   scripts/deploy-challenge-domain.sh            # rsync + permissions + verify
#   scripts/deploy-challenge-domain.sh --verify   # verify only, no upload

HOST="h69.seohost.pl"
IP="185.200.44.3"
USER="srv99920"
PORT="57185"
DOMAIN="showdown.lebene.pl"
REMOTE_DIR="domains/$DOMAIN/public_html"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$SCRIPT_DIR/../static/challenge-domain"

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

if [[ "${1:-}" == "--verify" ]]; then
    verify
    exit 0
fi

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
echo "Done. Once public DNS propagates, https://$DOMAIN/.well-known/* is live."
