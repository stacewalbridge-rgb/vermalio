# WhyDrive website — deploy branch

This orphan branch only carries the built WhyDrive marketing website and its Cloudflare Pages deploy workflow.
Source of truth: `stacewalbridge-rgb/robs-travel-booking-app`, folder `whydrive-website/` (branch `claude/whydrive-website-build-cm2orl`).

- `whydrive-site/public` — static site (built by `whydrive-website/tools/build.py`)
- `whydrive-site/functions` — Pages Functions (`/api/enquiry`, `/api/health`, www redirect)
- `whydrive-site/DEPLOY_TARGET` — `preview` or `main`
