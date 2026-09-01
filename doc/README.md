# PRSM documentation (`doc/`)

Documentation and sample assets for PRSM, split into three areas:

| Path | What it is |
| --- | --- |
| [`help/`](help/) | **User manual** sources (Rspress) → published help site |
| [`jsdoc/`](jsdoc/) | **Generated** API/function reference for frontend JS |
| [`examples/`](examples/) | Example `.prsm` maps and small demo scripts |

Parent overview: [../README.md](../README.md). Live manual: [https://prsm.uk/help.html](https://prsm.uk/help.html).

## User manual (`help/`)

Rspress site. Content lives under `help/docs/` (Markdown / MDX). Config: `help/rspress.config.ts`.

### Prerequisites

- Node.js **≥ 20.9.0** (`help/package.json` `engines`)
- For a full production build: Python venv used by `scripts/metadataForS3bucket.py` (see `help/scripts/`)

```bash
cd doc/help
npm install
# or from repo root:
npm run install:all
```

### Build commands

Prefer root scripts so deploy flags stay consistent:

| Command | Where | Purpose |
| --- | --- | --- |
| `npm run build-help` | repo root | Production build (`PRSM_DEPLOY=production`) |
| `npm run build-help-locally` | repo root | Local build (dev base path) |
| `npm run build` | `doc/help` | generate-meta → rspress → S3 metadata script |
| `npm run dev` | `doc/help` | generate-meta → rspress build (local iteration) |
| `npm run preview` | `doc/help` | Rspress preview server |

Base URL:

- Production (`PRSM_DEPLOY=production`): `/doc/help/doc_build/`
- Local default: `/prsm/doc/help/doc_build/`

Output directory: `help/doc_build/` (served with the static app; also copied into the httpd Docker image).

### Scripts under `help/scripts/`

| Script | Role |
| --- | --- |
| `generate-meta.mjs` | Generate metadata used by the doc build |
| `metadataForS3bucket.py` | Post-process metadata for Bedrock / S3 knowledge-base style publishing |
| `requirements.txt` + `venv/` | Python deps for the metadata script |

### Content notes

- Manual pages include product how-tos and advanced topics such as **Running PRSM locally** (`docs/manual/Advanced/RunningLocally.mdx`) — the same flow recommended in the root README for self-hosting.
- `llms: true` is enabled in Rspress config for LLM-oriented export of the manual.

## JSDoc (`jsdoc/`)

Generated from frontend sources under repo-root `js/` using root config [`.jsdoc.json`](../.jsdoc.json) (docdash template).

Regenerate from the monorepo root:

```bash
npm run jsdoc
```

Output is written to `doc/jsdoc/`. Treat this tree as **build output**; edit JSDoc comments in `js/*.js`, not the HTML here.

## Examples (`examples/`)

Sample maps and utilities used in docs or demos, for example:

- `*.prsm` — maps referenced by the user manual or training
- `update-factor-colors.js` / `update-factor-colors.php` — illustrative API/client snippets

These are not required to build or run PRSM.

## Related root commands

```bash
npm run build-help
npm run build-help-locally
npm run jsdoc
npm run spellcheck    # includes doc/help MDX
```

## Licence

Documentation is part of PRSM. See [../License.md](../License.md).
