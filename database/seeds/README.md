# Development seed data

`catalogue.json` describes a sample catalogue (categories, collections, stores and
products) used **only for development and automated tests**. Product imagery, try-on
cut-outs and 3D models are generated procedurally by `scripts/dev_assets` when the seed
runs (`make seed`); the generated files are cached in `.generated/` (gitignored).

Production data is entered through the admin dashboard or imported with the shop's own
assets. Nothing in this folder is referenced by application code outside `app/cli.py`.
