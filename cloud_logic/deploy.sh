#!/bin/bash
# Station-OS — Deploy Google Cloud Functions
# Usage: ./deploy.sh
#
# Required env vars:
#   GCP_PROJECT_ID      — your GCP project ID
#   SUPABASE_URL        — https://your-project.supabase.co
#   SUPABASE_SERVICE_KEY — Supabase service_role key (keep secret)
#
# Optional:
#   GCP_REGION (default: us-central1)

set -euo pipefail

: "${GCP_PROJECT_ID:?ERROR: GCP_PROJECT_ID is not set}"
: "${SUPABASE_URL:?ERROR: SUPABASE_URL is not set}"
: "${SUPABASE_SERVICE_KEY:?ERROR: SUPABASE_SERVICE_KEY is not set}"

REGION="${GCP_REGION:-us-central1}"
COMMON_ENV="SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}"

deploy_fn() {
  local fn_name="$1"
  local source_dir="cloud_logic/$2"
  local entry_point="${3:-$1}"

  echo "→ Deploying ${fn_name} from ${source_dir}..."
  gcloud functions deploy "${fn_name}" \
    --project="${GCP_PROJECT_ID}" \
    --runtime=python311 \
    --trigger-http \
    --allow-unauthenticated \
    --region="${REGION}" \
    --source="${source_dir}" \
    --entry-point="${entry_point}" \
    --set-env-vars="${COMMON_ENV}" \
    --memory=256MB \
    --timeout=60s
  echo "✓ ${fn_name} deployed."
}

echo "Station-OS: Deploying Cloud Functions to ${GCP_PROJECT_ID} (${REGION})"
echo "============================================================"

deploy_fn reconcile        reconciler        reconcile
deploy_fn detect_anomalies anomaly_detector  detect_anomalies
deploy_fn update_knowledge knowledge_updater update_knowledge

echo ""
echo "All functions deployed successfully."
echo "Set the GCF URLs as Supabase secrets:"
echo "  supabase secrets set RECONCILER_URL=https://${REGION}-${GCP_PROJECT_ID}.cloudfunctions.net/reconcile"
echo "  supabase secrets set ANOMALY_DETECTOR_URL=https://${REGION}-${GCP_PROJECT_ID}.cloudfunctions.net/detect_anomalies"
echo "  supabase secrets set GCF_AUTH_TOKEN=<your-shared-secret>"
