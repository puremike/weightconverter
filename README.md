# Weight Converter — Deployment & CI/CD Documentation

## Overview

This document describes the end-to-end deployment pipeline for the Weight Converter application. The stack uses **GitHub Actions** for CI/CD, **Docker Hub** for image registry, **Trivy** for vulnerability scanning, **ArgoCD** for GitOps-based continuous delivery, and **Kubernetes** as the deployment target.

---

## Architecture

```
Developer Push / Tag
        │
        ▼
  GitHub Actions
  ┌─────────────────────────────────────┐
  │  1. Checkout code                   │
  │  2. Login to Docker Hub             │
  │  3. Build Docker image              │
  │  4. Scan with Trivy                 │
  │  5. Push image (on tag only)        │
  │  6. Update k8s/deployment.yml       │
  │  7. Commit & push manifest changes  │
  └─────────────────────────────────────┘
        │
        ▼
  Git Repository (main branch)
  k8s/deployment.yml updated with new image tag
        │
        ▼
  ArgoCD (watches main branch → k8s/)
        │
        ▼
  Kubernetes Cluster
  namespace: weight-converter
```

---

## Trigger Conditions

The pipeline is defined in `.github/workflows/ci-cd.yml` and triggers on:

| Event | Branch / Pattern | Behaviour |
|---|---|---|
| `push` | `main` | Builds and scans the image only (no push, no deploy) |
| `push` | `v*.*.*` (semver tag) | Full pipeline: build, scan, push image, update manifest, trigger ArgoCD sync |
| `pull_request` | `main` | Builds and scans the image only |

> **Deployment only happens when a semver tag is pushed.** A plain push to `main` will build and scan but will not publish an image or deploy to Kubernetes.

---

## CI/CD Pipeline — GitHub Actions

### Job: `docker-build`

Runs on `ubuntu-latest` under the `prod` environment.

#### Step-by-step Breakdown

**1. Checkout**
Checks out the repository at the triggering ref.

**2. Login to Docker Hub**
Authenticates using repository-level variables and secrets:
- `vars.DOCKER_USERNAME` — your Docker Hub username
- `secrets.DOCKER_ACCESS_TOKEN` — your Docker Hub access token

**3. Extract Docker Metadata**
Uses `docker/metadata-action` to generate tags:
- `<sha>` — always applied (e.g. `abc1234`)
- `<major>.<minor>` — applied only on semver tag pushes (e.g. `1.2`)

**4. Build Docker Image**
Builds from `./app/Dockerfile`. The image is loaded into the local Docker daemon for scanning. It is only pushed to Docker Hub when the trigger is a semver tag.

**5. Trivy Vulnerability Scan**
Scans the locally built image for `CRITICAL` and `HIGH` severity vulnerabilities across OS packages and libraries. Unfixed vulnerabilities are ignored. The pipeline **fails** (`exit-code: 1`) if any fixable critical or high CVEs are found.

**6. Update Kubernetes Manifest** *(tag push only)*
Replaces the `image:` field in `k8s/deployment.yml` with the newly built image reference, using the `<major>.<minor>` semver tag:

```
docker.io/<DOCKER_USERNAME>/weight-converter:<major>.<minor>
```

**7. Commit and Push Manifest** *(tag push only)*
Commits the updated `k8s/deployment.yml` back to `main` using `stefanzweifel/git-auto-commit-action`. The commit message includes the new version tag. This is the GitOps trigger — ArgoCD detects this commit and syncs the cluster.

---

## Required Secrets & Variables

Configure these under **Settings → Environments → prod** in your GitHub repository:

| Name | Type | Description |
|---|---|---|
| `DOCKER_USERNAME` | Variable (`vars`) | Docker Hub username |
| `DOCKER_ACCESS_TOKEN` | Secret (`secrets`) | Docker Hub access token with read/write scope |

---

## CD — ArgoCD (GitOps)

ArgoCD is configured via `argocd/application.yml` and watches the `k8s/` directory on the `main` branch of this repository.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: weight-converter
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/puremike/weightconverter.git
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: weight-converter
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

### How Automatic Sync Works

ArgoCD polls the `main` branch for changes to the `k8s/` directory. When GitHub Actions commits the updated `k8s/deployment.yml` (step 7 above), ArgoCD detects the drift between the live cluster state and the desired state in Git, and automatically reconciles by rolling out the new image to the `weight-converter` namespace.

> `CreateNamespace=true` ensures the `weight-converter` namespace is created automatically on first deploy without any manual `kubectl` intervention.

### Apply the ArgoCD Application

```bash
kubectl apply -f argocd/application.yml
```

This registers the application with your ArgoCD instance. All subsequent deployments are handled automatically through the GitOps flow described above.

---

## Deploying a New Version

The full deployment flow is triggered by creating and pushing a semver tag:

```bash
# Ensure your changes are merged to main first
git checkout main
git pull

# Create and push a semver tag
git tag v1.0.0
git push origin v1.0.0
```

This will:
1. Trigger the GitHub Actions pipeline
2. Build, scan, and push `docker.io/<username>/weight-converter:1.0` to Docker Hub
3. Update `k8s/deployment.yml` with the new image tag and commit it to `main`
4. ArgoCD detects the commit and rolls out the new version to Kubernetes

---

## Kubernetes Manifests

All Kubernetes resources live in the `k8s/` directory. ArgoCD applies everything in this directory to the `weight-converter` namespace on the in-cluster Kubernetes server (`https://kubernetes.default.svc`).

The key file managed by the pipeline is `k8s/deployment.yml`. Its `image:` field is automatically rewritten on every tagged release — **do not manually edit this field**.

---

## Notes

- The pipeline does **not** use `docker/build-push-action`'s `push: true` on branch pushes — images are only published on tag events. This prevents unversioned images from polluting the registry.
- Trivy runs against the SHA-tagged image that was loaded locally, ensuring the scan targets the exact artifact that will be pushed.
- ArgoCD sync is intentionally left as polling-based (no webhook configured). If you want faster sync, configure an [ArgoCD webhook](https://argo-cd.readthedocs.io/en/stable/operator-manual/webhook/) pointing to your ArgoCD server.
