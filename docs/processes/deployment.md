# Deployment Process

## Infrastructure

- **Host**: Proxmox server at `10.0.3.244` (SSH alias: `docker-condominio`)
- **Container**: `condominio-app-1` (Docker)
- **Domain**: `condominio.pereiraru.com`
- **Runner**: GitHub Actions self-hosted runner on the same Proxmox server

## Automatic Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. Checkout code
2. Create `.env` file with `NEXTAUTH_SECRET` from GitHub Secrets
3. `docker compose build --no-cache`
4. `docker compose up -d`

## Manual Deployment

### Via GitHub Actions
```bash
gh workflow run "Deploy to Proxmox" --ref main
gh run list --limit 1
gh run watch <run-id>
```

### Via SSH (emergency)
```bash
ssh docker-condominio
cd /path/to/condominio
docker compose build --no-cache
docker compose up -d
```

## Checking Status

```bash
# Container status
ssh docker-condominio "docker ps --filter name=condominio"

# Container logs
ssh docker-condominio "docker logs condominio-app-1 --tail 50"

# Files in container
ssh docker-condominio "docker exec condominio-app-1 ls -la /app/public/uploads/"
```

## Database Access

The SQLite database is inside the Docker volume:
```bash
# Copy database from container
ssh docker-condominio "docker cp condominio-app-1:/app/prisma/dev.db /tmp/dev.db"
scp docker-condominio:/tmp/dev.db ./prisma/dev.db
```

## Volumes

- `condominio_db_data` — SQLite database (`/app/prisma/`)
- `condominio_uploads` — Uploaded files (`/app/public/uploads/`)

These volumes persist across container rebuilds.
