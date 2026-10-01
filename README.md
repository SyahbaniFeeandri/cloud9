# FinCloud

Cloud-Based Financial Management and Monitoring Platform.

## Service
- fincloud-frontend
- fincloud-backend
- fincloud-database
- fincloud-object-storage
- fincloud-monitoring
- fincloud-logging

## Prasyarat
- Docker
- Docker Compose

## Struktur Project 
```text
fincloud-app/
├── backend/
├── frontend/
├── database/
├── docs/
├── infra/
├── scripts/
└── tests/

## Cara Menjalankan
```bash
cp .env.example .env
docker compose up -d
