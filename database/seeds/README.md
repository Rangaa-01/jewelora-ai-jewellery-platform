# Development seed data

`catalogue.json` describes a sample catalogue (categories, collections, stores and
products) used **only for development and automated tests**. Products reference real CC0
photographs in `photos/` (see `photos/ATTRIBUTION.md`); the seeder uploads them and derives
try-on cut-outs automatically. Products without `photos` fall back to procedurally drawn
assets from `scripts/dev_assets` (cached in `.generated/`, gitignored). `make seed` is
idempotent; `python -m app.cli seed --prune` also removes products missing from the file.

Production data is entered through the admin dashboard or imported with the shop's own
assets. Nothing in this folder is referenced by application code outside `app/cli.py`.
