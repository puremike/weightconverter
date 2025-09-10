# Weight Converter App

A beautiful, responsive web application to convert weights between kilograms and pounds with precision and instant results.

## Features

- Instantly convert between kilograms and pounds
- Adjustable decimal precision
- Copy and paste support
- Accessible, mobile-friendly UI
- Swap units with a single click

## Project Structure
- Frontend static files - (HTML, CSS, JS, Dockerfile)
- k8s/ - Kubernetes manifests (deployment, service, ingress) 
- Argocd - ArgoCD application manifest 
- CICD - .github CI/CD workflow for Docker build and deploy

## Getting Started

### Local Development

1. Open [app/index.html](app/index.html) in your browser to use the converter locally.

### Docker

Build and run the app using Docker:

```docker build -t weight-converter ./app```
```docker run -p 8080:80 weight-converter```

Then visit http://localhost:8080.

### Kubernetes
Apply the manifests in k8s/ to deploy on your cluster: ```kubectl apply -f k8s/```

### ArgoCD
Use argocd/app.yml to manage deployments via ArgoCD: ```kubectl apply -f argocd/

### CI/CD
Automated Docker build, scan, and deployment are configured in .github/workflows/cicd.yml.

## License
MIT