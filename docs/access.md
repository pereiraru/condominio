# Access & Infrastructure

## Production Server (Proxmox)

| Detail | Value |
|--------|-------|
| Host | `10.0.3.244` |
| SSH alias | `docker-condominio` |
| User | `root` |
| SSH key | `~/.ssh/condominio` |
| Container | `condominio-app-1` |
| App port | `3100` (maps to container `3000`) |

### SSH Connection

```bash
ssh docker-condominio
```

SSH config (`~/.ssh/config`):
```
Host docker-condominio
    HostName 10.0.3.244
    User root
    IdentityFile ~/.ssh/condominio
    IdentitiesOnly yes
```

### Docker Commands

```bash
# Container status
ssh docker-condominio "docker ps --filter name=condominio"

# Container logs
ssh docker-condominio "docker logs condominio-app-1 --tail 50"

# Shell into container
ssh docker-condominio "docker exec -it condominio-app-1 sh"

# List uploaded files
ssh docker-condominio "docker exec condominio-app-1 ls -la /app/public/uploads/"

# Copy database from container
ssh docker-condominio "docker cp condominio-app-1:/app/data/condominio.db /tmp/condominio.db"
scp docker-condominio:/tmp/condominio.db ./prisma/dev.db
```

### Docker Volumes

| Volume | Container path | Content |
|--------|---------------|---------|
| `db-data` | `/app/data/` | SQLite database (`condominio.db`) |
| `uploads` | `/app/public/uploads/` | Uploaded documents (PDFs, etc.) |

---

## GitHub

| Detail | Value |
|--------|-------|
| Repository | [pereiraru/condominio](https://github.com/pereiraru/condominio) |
| Branch | `main` |
| CI/CD | GitHub Actions (self-hosted runner on Proxmox) |
| Workflow | "Deploy to Proxmox" (`deploy.yml`) |

### Secrets (configured in GitHub)

| Secret | Purpose |
|--------|---------|
| `NEXTAUTH_SECRET` | NextAuth session encryption key |

### Manual Deploy

```bash
gh workflow run "Deploy to Proxmox" --ref main
gh run list --limit 1
gh run watch <run-id>
```

---

## Application

| Detail | Value |
|--------|-------|
| URL | `https://condominio.pereiraru.com` |
| Local dev | `http://localhost:3000` |
| Database (prod) | SQLite at `/app/data/condominio.db` (Docker volume) |
| Database (dev) | SQLite at `prisma/dev.db` |

### Environment Variables

| Variable | Dev | Production |
|----------|-----|------------|
| `DATABASE_URL` | `file:./dev.db` | `file:/app/data/condominio.db` |
| `NEXTAUTH_SECRET` | (any string) | GitHub Secret |
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://condominio.pereiraru.com` |

### Default Admin Account

Created via `node scripts/create-admin.js [email] [password]`

Defaults: `admin@condominio.pt` / `admin123`

---

## Other Servers on Same Network

| Host | IP | SSH alias | Purpose |
|------|----|-----------|---------|
| Docker/Proxmox | `10.0.3.244` | `docker-condominio` | Docker host for this app |
| Home Assistant | `10.0.3.101` | `homeassistant` | Home automation (separate) |
