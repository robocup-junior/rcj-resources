# RoboCupJunior Resource Library

The data behind the resource library at **[junior.robocup.org/resources](https://junior.robocup.org/resources/)**: rules, tutorials, code, practice fields, videos and Workshop on Educational Robotics (WEROB) talks for every RoboCupJunior league.

Each resource is one small YAML file in [`resources/`](resources/). When a change is merged into `main`, it is published automatically and appears on the website within about ten minutes.

## Suggest a resource

**[Open a "Suggest a resource" issue](../../issues/new?template=suggest-resource.yml)** and fill in the form. You don't need to know Git.

A maintainer reviews it and adds the **approved** label. A bot then opens a pull request with the resource file, and the maintainer merges it.

You can also add a file yourself and open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## How it works

```
resources/*.yml ──merge to main──► GitHub Action ──► resources.json on GitHub Pages ──► junior.robocup.org/resources
```

- **[Check resources](.github/workflows/validate.yml)** runs on every pull request. It checks that each file has the right fields and that new links work.
- **[Publish to website](.github/workflows/publish.yml)** builds [`resources.json`](https://robocup-junior.github.io/rcj-resources/resources.json) and publishes it to GitHub Pages.
- **[Weekly link check](.github/workflows/weekly-links.yml)** checks every link each week and opens a **Broken links** issue if any stop working.
- **[Approved suggestion](.github/workflows/approved-suggestion.yml)** turns an approved suggestion issue into a pull request.

The website page loads `resources.json` when someone visits. If GitHub can't be reached, it shows a built-in copy instead.

## Running it locally

```
npm install
npm run build          # validate everything and write dist/resources.json
npm run check-links    # check every link (takes a few minutes)
node scripts/check-links.mjs resources/some-file.yml   # check one file
```
