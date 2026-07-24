#!/usr/bin/env bash
# Deploy the Countdown PWA to S3 + CloudFront.
#   ./deploy/aws/deploy.sh [stack-name] [aws-profile]
#
# Optional second target alongside GitHub Pages — useful if you want the app on
# a custom domain. Pages is the primary; see .github/workflows/pages.yml.
set -euo pipefail

STACK="${1:-countdown-pwa}"
PROFILE="${2:-default}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="$ROOT/dist"
AWS=(aws --profile "$PROFILE")

echo "==> Building"
(cd "$ROOT" && npm run build)

echo "==> Deploying stack: $STACK"
"${AWS[@]}" cloudformation deploy \
  --stack-name "$STACK" \
  --template-file "$ROOT/deploy/aws/infra/countdown-site.yaml" \
  --no-fail-on-empty-changeset

out() {
  "${AWS[@]}" cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(out BucketName)"
DIST="$(out DistributionId)"
URL="$(out URL)"

echo "==> Syncing site to s3://$BUCKET"
# Everything under assets/ is content-hashed, so it can be cached forever.
# The shell, the worker and the manifest are not, so they must not be.
"${AWS[@]}" s3 sync "$SITE/" "s3://$BUCKET/" --delete \
  --exclude "index.html" --exclude "sw.js" --exclude "manifest.json" \
  --cache-control "public,max-age=31536000,immutable"

"${AWS[@]}" s3 cp "$SITE/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"

"${AWS[@]}" s3 cp "$SITE/sw.js" "s3://$BUCKET/sw.js" \
  --cache-control "no-cache" --content-type "text/javascript; charset=utf-8"

"${AWS[@]}" s3 cp "$SITE/manifest.json" "s3://$BUCKET/manifest.json" \
  --cache-control "public,max-age=86400" --content-type "application/manifest+json"

echo "==> Invalidating shell"
"${AWS[@]}" cloudfront create-invalidation \
  --distribution-id "$DIST" --paths "/" "/index.html" "/sw.js" "/manifest.json" >/dev/null

echo
echo "Done.  $URL"
echo "Open that in Safari on your iPhone, then Share -> Add to Home Screen."
