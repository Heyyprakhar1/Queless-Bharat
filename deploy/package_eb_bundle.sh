#!/usr/bin/env bash
# ==============================================================================
# Queueless Bharat — Elastic Beanstalk Bundle Packaging Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR=$(mktemp -d /tmp/eb-bundle-staging-XXXXXX)

cleanup() {
    rm -rf "${STAGE_DIR}"
}
trap cleanup EXIT

VERSION_TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
BUNDLE_NAME="queueless-bharat-eb-${VERSION_TAG}.zip"
TARGET_ZIP="${DIST_DIR}/${BUNDLE_NAME}"

mkdir -p "${DIST_DIR}"

echo "===================================================================="
echo " Packaging Queueless Bharat Elastic Beanstalk Source Bundle"
echo " Version: ${VERSION_TAG}"
echo " Staging Directory: ${STAGE_DIR}"
echo " Output Archive:    ${TARGET_ZIP}"
echo "===================================================================="

# 1. Copy docker-compose.eb.yml to root docker-compose.yml in bundle
cp "${SCRIPT_DIR}/docker-compose.eb.yml" "${STAGE_DIR}/docker-compose.yml"

# 2. Copy .ebextensions directory
cp -r "${SCRIPT_DIR}/.ebextensions" "${STAGE_DIR}/.ebextensions"

# 3. Security verification: ensure zero secrets or dot-env files are staged
if find "${STAGE_DIR}" -name "*.env*" | grep -q .; then
    echo "ERROR: Environment file detected in staging directory! Aborting."
    exit 1
fi

# 4. Generate deployment zip archive
(
    cd "${STAGE_DIR}"
    zip -q -r "${TARGET_ZIP}" docker-compose.yml .ebextensions/
)

# 5. Generate SHA-256 checksum
CHECKSUM=$(sha256sum "${TARGET_ZIP}" | cut -d' ' -f1)
echo "${CHECKSUM}  ${BUNDLE_NAME}" > "${TARGET_ZIP}.sha256"

# 6. Validate bundle contents
echo "Archive created successfully."
echo "SHA256: ${CHECKSUM}"
echo "Contents:"
unzip -l "${TARGET_ZIP}"

# Also maintain canonical symlink or copy to dist/queueless-bharat-eb.zip
cp "${TARGET_ZIP}" "${DIST_DIR}/queueless-bharat-eb.zip"
echo "${CHECKSUM}  queueless-bharat-eb.zip" > "${DIST_DIR}/queueless-bharat-eb.zip.sha256"

echo "===================================================================="
echo " Deployment bundle ready at: ${DIST_DIR}/queueless-bharat-eb.zip"
echo "===================================================================="
