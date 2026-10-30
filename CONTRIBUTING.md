# Adding or changing a resource

The easiest way is the **[Suggest a resource](../../issues/new?template=suggest-resource.yml)** form. To edit files directly, read on.

## What belongs here

Free resources that help RoboCupJunior teams, mentors or organizers: rules and guides, tutorials, open-source code and tools, field and equipment plans, videos, community spaces, teaching and curriculum material, research about RoboCupJunior, and WEROB talks and papers.

- Link to the **current version** of rules and guides, not a copy that will go out of date.
- Prefer resources that work for **any platform** over ones tied to one kit or brand.
- If a link has died, use a [Wayback Machine](https://web.archive.org/) copy if one exists.

## One file per resource

Add a file to `resources/` named after the title, for example `resources/getting-started-with-rescue-line.yml`. WEROB talks and papers go in `resources/werob/`, starting with the year, for example `resources/werob/2026-my-talk.yml`. Research papers go in `resources/research/` the same way. Only add papers that are free to read.

```yaml
title: Getting Started with Rescue Line
url: https://www.robocupjunior.org.au/getting-started/
description: Workshop slides, from basic line following to PID control.
leagues:
  - line
type: tutorial
level: beginner
source: RoboCupJunior Australia
```

| Field | Required | What to put |
| --- | --- | --- |
| `title` | yes | The resource's name. |
| `url` | yes | A full link starting with `https://`. |
| `description` | yes | One or two sentences, 300 characters at most. |
| `leagues` | yes | One or more of `soccer`, `line` (Rescue Line), `maze` (Rescue Maze), `sim` (Rescue Simulation), `onstage`, `general` (useful for any league). |
| `type` | yes | One of `rules`, `tutorial`, `code`, `field`, `video`, `community`, `teaching` (curriculum and classroom material), `research` (published papers), `werob`. |
| `level` | yes | `beginner`, `intermediate` or `advanced`. |
| `source` | yes | Who made or publishes it, for example `RoboCupJunior Australia` or `GitHub`. For WEROB, use `WEROB <year>, <city>`. |
| `audience` | no | Who besides teams it is especially for: a list of `students`, `educators`, `organizers`. Resources marked `educators` also appear on the [For Educators](https://junior.robocup.org/for-educators/) page. |
| `year` | WEROB only | The year of the workshop (or of publication, for research papers). |
| `authors` | no | For talks and papers. |
| `links` | no | Extra links shown on the card, such as slides: a list of `label` and `url`. |

Example with extra links:

```yaml
title: "RoboCupJunior Rescue Simulation 2023: Machinosus"
url: https://drive.google.com/file/d/171P6gOl3I-pMycJGA4wWDKQTfUi3XT-9/view
description: Student team paper.
leagues:
  - sim
type: werob
level: advanced
source: WEROB 2023, Bordeaux
year: 2023
authors: Andrew Chen, Andrew Dai, Peter Leong and Dhruva Chakravarthi
links:
  - label: Slides
    url: https://drive.google.com/file/d/1Kvw3bZg7gZz0mL4QtTF6NEfeFPqNCcN_/view
```

Put quotes around a title that contains a colon, as above.

## Before you open a pull request

Run `npm install` once, then `npm run build` to check your file. The pull request runs the same check plus a link check, and a maintainer merges it once it passes.

## For maintainers

Only the RCJ execs and the Soccer, Rescue and OnStage league committees can approve suggestions and merge pull requests, and `main` only changes through pull requests. Merging is what publishes to the website.

- **Suggestions:** read the issue, check the link, and add the **approved** label. The bot opens a pull request. If the form had a problem, the bot comments on the issue and removes the label, so the issue can be fixed and approved again.
- **Pull requests from the bot** don't run the "Check resources" workflow, because GitHub doesn't let bot-created pull requests trigger other workflows. The bot runs the same checks itself and puts the link check result in the pull request.
- **Broken links:** the weekly check opens a **Broken links** issue. Fix the link, swap in a Wayback Machine copy, or delete the file.
