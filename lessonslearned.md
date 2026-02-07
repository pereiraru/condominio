# Lessons Learned - Production Deployment

This document tracks challenges faced during the deployment of the Condomínio Management System and the solutions implemented to resolve them.

## 1. Local vs. Remote Synchronization
- **Problem**: Code changes implemented locally were not appearing in production even after triggering the deployment workflow.
- **Root Cause**: The GitHub Actions workflow pulls code from the remote repository (`origin main`). If local changes are not pushed to the remote, the build server continues to use the old code.
- **Solution**: Always `git push origin main` before relying on the automatic deployment pipeline.

## 2. Strict Production Build Requirements
- **Problem**: The deployment failed repeatedly with "exit code 17" during the `npm run build` step inside Docker.
- **Root Cause**: Next.js production builds have strict ESLint and TypeScript checks enabled by default. Issues that might be warnings in development (unused variables, `any` types, minor syntax errors) are treated as fatal errors during build.
- **Solution**: 
    - Run `npm run build` locally to catch errors before pushing.
    - Clean up all unused variables in `catch` blocks (change `catch (error)` to `catch` if the variable isn't used).
    - Provide proper interfaces or use `// eslint-disable-next-line` for necessary `any` types.
    - Ensure all JSX tags are properly closed (verified using `npx tsc` or `npx eslint`).

## 3. Browser and CDN Caching
- **Problem**: Even after a successful build and container restart, the UI still showed old data/layout (e.g., the old year columns).
- **Root Cause**: Aggressive browser caching of JavaScript chunks and potentially CDN (Cloudflare) caching. Next.js uses hashed filenames, but index pages or service workers can sometimes hold onto old references.
- **Solution**: 
    - Implement a "version marker" (e.g., a hidden or small text label like `v2.0`) in the UI to definitively verify which version is being served.
    - Advise users to perform a "Hard Refresh" (Cmd+Shift+R or Ctrl+F5).
    - Use Incognito/Private mode for verification.

## 4. Containerized Environment Constraints
- **Problem**: Unable to use standard diagnostic tools like `curl` inside the production container to test API routes.
- **Root Cause**: Minimal Docker images (like `node:alpine` or standard Next.js deployment templates) exclude non-essential binaries for security and size.
- **Solution**: 
    - Use `node -e` to run one-liner fetch scripts for testing APIs from within the container.
    - Inspect the `.next` directory timestamps and grep compiled chunks (`.next/static/chunks/...`) to verify code presence.

## 5. Deployment Workflow Reliability
- **Problem**: Deployment was a "black box" until the GitHub CLI (`gh`) was used to monitor logs.
- **Root Cause**: Relying on web UIs for deployment status is slow.
- **Solution**: Use `gh run watch` and `gh run view --log-failed` to get immediate feedback on why a production build failed.
