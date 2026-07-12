# SolidJS-Axum Template

A simple full-stack web application template, using SolidJS as frontend and Axum as backend.

## Prerequisites

Before running this project, ensure you have the following installed:
1. **Node.js** (v24 or higher)
2. **PNPM** - Package manager
    ```bash
    npm install -g pnpm
    ```
3. **Rust programming language**, installed using [rustup](https://rustup.rs/).

## Getting Started

1. **Install dependencies:**
    Frontend:
    ```bash
    pnpm run frontend:deps
    ```

    Backend:
    ```bash
    pnpm run backend:build
    ```

2. **Copy and adjust environment variables:**
    In each `backend` and `frontend` packages, there is `.env.example` package. Copy to `.env`, then adjust the values as needed.

3. **Start the development server:**
    Backend:
    ```bash
    pnpm run backend:start
    ```

     Frontend (must wait until the backend starts):
     ```bash
     pnpm run frontend:start
     ```

## Cloud Run Deployment (Backend)

INFO: You should run `pnpm run backend:build-release` before deploying to backend.

The backend is deployed to Google Cloud Run using source-based deployment.

### Prerequisites

1. **Google Cloud SDK** (`gcloud`) installed and authenticated.
2. **Secrets stored in Google Cloud Secret Manager:**

    ```bash
    echo -n "<openrouter-api-key>" | gcloud secrets create openrouter-api-key --data-file=-
    ```
3.  **Allow secrets to be accessed by Service Account:**

    ```bash
    gcloud secrets add-iam-policy-binding openrouter-api-key \
        --member="serviceAccount:{{service account email}}" \
        --role="roles/secretmanager.secretAccessor"
    ```

### Files

| File | Purpose |
|---|---|
| `apps/backend/Dockerfile` | Container image — builds the Rust binary and runs it on port 8080 |
| `apps/backend/.env.cloudrun.yaml` | Non-sensitive env vars (`HOST`) — gitignored |

### Deploy

```bash
gcloud run deploy mandarin-text-parser \
    --source ./apps/backend \
    --region asia-southeast1 \
    --allow-unauthenticated \
    --env-vars-file apps/backend/.env.cloudrun.yaml \
    --set-secrets="OPENROUTER_API_KEY=openrouter-api-key:latest"
```
