# Independent workshops

- Each `YYYY/<workshop>/` owns its frontend, dependencies, lockfiles, backend,
  build system, directory structure, and local guidance. Read its instructions
  before changing it. Do not impose one workshop's API, visual system, or tooling
  on another.
- Root tooling only discovers `workshop.json`, runs declared commands in that
  workshop's directory, and assembles explicitly declared public output.
- Preserve existing published URLs, spelling, capitalization, relative assets,
  and storage contracts, including archived pages.
- Keep repository-wide documentation and guidance general. Project-specific
  requirements, implementation details, and migration plans belong inside their
  owning project. The root README is a minimal structure guide and homepage directory.
- Do not publish repository source wholesale. Only `.pages/` is a Pages artifact.
  Backend source, credentials, dependencies, and internal content do not belong
  in a workshop's public output.
- Backend workflows must be scoped to their owning workshop. They may use any
  appropriate runtime or hosting platform. Pages assembly never deploys a backend
  or requires its credentials.
- For root infrastructure changes, run `npm test`, build the registered workshops
  as appropriate, and run `git diff --check`. Do not commit generated output.
