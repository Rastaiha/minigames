# Independent projects

Each `YYYY/<project>/` owns its frontend, backend, dependencies, lockfiles, build
system, hosting, internal structure, and local guidance. Shared tooling runs the
project's declared commands and combines its public output. It does not impose a
framework, API, package workspace, or game layout.

Keep project-specific details and migration plans in the owning project. This
guide contains only shared rules and generic examples. The root README is a
minimal structure guide and a directory of project homepages.

## Commands

Root tooling requires Node.js 22.12 or newer and has no npm dependencies:

```sh
npm test
npm run workshops
npm run workshop -- install 2026/example
npm run workshop -- check 2026/example
npm run workshop -- dev 2026/example
npm run workshop -- build 2026/example
npm run build
node scripts/workshops.mjs verify
npm run catalog
```

Commands run from the selected project's directory. `build` does not implicitly
install dependencies or run checks. A selected build only replaces that project's
`.pages/YYYY/<project>/` output. Projects may also use their own local commands.

## Project registration

Add `workshop.json` inside `YYYY/<project>/`. No central registry edit is needed.
Unregistered directories are ignored. Project directory names use lowercase
kebab-case; internal paths are unrestricted.

A generic built frontend might declare:

```json
{
  "version": 1,
  "title": "نمونه",
  "commands": {
    "install": [["npm", "ci"]],
    "check": [["npm", "test"]],
    "build": [["npm", "run", "build"]],
    "dev": [["npm", "run", "dev"]]
  },
  "publish": {"directory": "site/dist"},
  "entries": ["index.html", "activity/index.html"]
}
```

Each command is a sequence of argument arrays, executed without an implicit
shell. Put complex orchestration in project-owned scripts. Omitted `install`,
`check`, `build`, `ciSetup`, and `ciCheck` commands are no-ops. `dev` and custom
commands invoked through `run` must exist.

`ciSetup` prepares extra CI tools; `ciCheck` can run browser checks or other
CI-only validation. Shared CI provides Ubuntu and Node 22. Projects may prepare
other runtimes through their scripts or additional scoped workflows.

The optional boolean `continueOnError` defaults to `false`. Set it to `true` in
`workshop.json` to report failed `ciSetup`, `check`, and `ciCheck` steps as CI
warnings while continuing to build and publish. These failures do not fail the
project job or block merging through that job. Local check commands still return
failure so developers can diagnose problems. Installation, build, staging, and
publication failures always block; this setting only applies to validation.
Allowed check failures also produce a prominent warning in the workflow summary,
with each validation step's result. The job status remains green if the build
and other required steps succeed.

`publish.directory` is relative to the project. All declared `entries` must exist
in its output. Nested entry paths retain their hierarchy. Plain HTML projects can
omit `build` and use `publish.directory: "."`, an explicit `publish.include` array
of literal file/directory paths, and an optional `publish.extensions` allowlist.

Fully server-rendered or externally hosted projects can omit `publish` and
`entries`. Their checks and builds still run, and their own workflow handles
deployment. They contribute no Pages artifact.

## Homepage directory and README rendering

A declared `index.html` is automatically listed as the project's homepage. An
optional `homepage` can instead name another declared HTML entry or an external
HTTP(S) URL. Projects without a homepage are omitted from the directory.

`npm run catalog` updates only the minimal root README from this metadata. It does
not scan source HTML for games or rewrite project READMEs.

To use an existing Markdown file as a project's homepage, opt in explicitly:

```json
{
  "publish": {
    "directory": ".",
    "include": ["activity", "assets"],
    "readmeHomepage": "README.md"
  },
  "entries": ["activity/index.html"]
}
```

The original Markdown is copied unchanged to the staged project. During CI,
GitHub Pages' Jekyll action renders it at that project's `index.html`, alongside
the root README's directory page. This adds no npm dependency to any project.
Choose either a built `index.html` or a README homepage for a project.
For a README-only project, use an empty `publish.include` array and omit `entries`.

Only these opted-in documents enter Jekyll. Built frontends and other public
files bypass it. The renderer's output is merged only after checking every file
collision; rendering must never overwrite a project's existing output.

`prepare-readmes` prepares `.readme-pages/` for the Jekyll action, which writes
`.readme-site/`; `merge-readmes` checks and merges the rendered pages into
`.pages/`. These are generated directories and are not committed. A local static
assembly does not render Markdown; that rendering step runs in the Pages CI job.

## Public paths and environment

The public prefix follows the project's directory. For example,
`2026/example/activity/index.html` publishes below the repository base path at
`/minigames/2026/example/activity/index.html`.

Each declared command receives:

| Variable | Meaning |
| --- | --- |
| `WORKSHOP_ROOT` | Absolute project directory |
| `WORKSHOP_PUBLIC_PATH` | Full public prefix, such as `/minigames/2026/example` |
| `BASE_PATH` | Same prefix, available to project-specific framework configuration |
| `SITE_URL` | Site origin |

Use `PAGES_BASE_PATH` and `PAGES_SITE_URL` to override the repository's deployment
base and origin. Preserve existing published URLs, relative assets, and storage
contracts. Shared tooling does not rewrite frontend code or asset references.

## CI and deployment boundaries

`deploy-pages.yml` gives each registered project its own runner, dependencies,
checks, build, and artifact. A failed project job does not cancel its siblings.
Pull requests also validate assembly and README rendering without deployment.
Successful `main` runs publish one combined Pages artifact. Because Pages is a
single deployment, publication waits for all projects and never ships a partial
collection.

Only explicitly declared public output is staged. Backend source, dependencies,
credentials, and private content do not belong in that output. Built projects
should publish their final static output rather than their source tree. Staging
also excludes common metadata and credential paths and rejects public symlinks;
projects remain responsible for choosing their public files deliberately.

Backends may use any appropriate runtime or hosting. Keep their code, database
and migration tools, configuration, and instructions inside their project. Backend
workflows belong in the root `.github/workflows/` directory with path filters
scoped to their owning project and workflow. Static publishing never deploys a
backend or requires production service credentials. Use mock services for checks
when appropriate. Running servers, databases, and persistent connections require
their own hosting.
