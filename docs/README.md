# Agentic Kanban Documentation

This directory contains the documentation site for **Agentic Kanban**, built using [Astro Starlight](https://starlight.astro.build/).

## Local Development

To run the documentation site locally:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build the static site:
   ```bash
   npm run build
   ```
4. Preview the production build locally:
   ```bash
   npm run preview
   ```

## Cloudflare Pages Deployment

This site is deployed to **Cloudflare Pages** via static build outputs.

### Cloudflare Dashboard Configuration
When creating the Cloudflare Pages project, configure the following settings:
- **Project Name:** `agentic-kanban-docs`
- **Framework Preset:** `Astro`
- **Root Directory:** `docs`
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`

### CI/CD Auto-Deployment
Every push to `main` touching `docs/**` will trigger the `.github/workflows/deploy-docs.yml` GitHub Actions workflow. The workflow requires the following secrets in the GitHub repository:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages edit permissions.
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID.
