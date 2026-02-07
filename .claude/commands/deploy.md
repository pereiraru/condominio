Deploy the application to production (Proxmox via GitHub Actions).

Steps:
1. Check for uncommitted changes with `git status`
2. If there are changes, ask whether to commit first
3. Push to main branch: `git push origin main`
4. Trigger the deploy workflow: `gh workflow run "Deploy to Proxmox" --ref main`
5. Watch the deployment: `gh run list --limit 1` then `gh run watch <id>`
6. Once deployed, verify the app is running by checking `ssh docker-condominio "docker ps --filter name=condominio"`

$ARGUMENTS
