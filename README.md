# Faster Horse volunteer checklists

This repository is the standalone QA website. `index.html` at the repository root includes everything needed to run it.

**Short is the default: 8 checks per game mode, 2 website checks.** The final game check asks about other bugs, with examples such as invisible obstacles, wall driving and falling through the road.

**Extensive is optional:** select it at the start or switch using the button above the sections. Its 124-case catalogue filters to 88 solo, 83 multiplayer or 6 website checks. It restores the detailed feature coverage without gates, mandatory answers, timed waits, required screenshots, video requests or organiser requirements.

Every field is optional in both versions. Volunteers can skip checks and download a report whenever they stop. Only the extensive checklist has navigation selectors: **Section** groups broad areas, and **Subsection** selects a feature group. The short version uses Previous / Next and Skip without section controls. The game Mode is shown on each card.

## Hosting

`index.html` is self-contained, including both checklists and the Faster Horse logo. Send the file for desktop use or host it as a static webpage. No backend is needed. This task does not publish a site.

The QA page has no API, polling, analytics, remote-font or remote-image requests. Its browser policy blocks script connections. Hosting serves the initial HTML file; answers, screenshot attachments, imports and exports remain local. The actual game's normal online requests are separate.

### GitHub Pages

1. Push the repository, including `index.html` and `.nojekyll`, to `main`.
2. In the repository's **Settings → Pages → Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/ (root)**, then **Save**.
4. Wait for the Pages deployment to finish, then open `https://bomlab.github.io/FasterHorse_QA/` (unless a custom domain is configured).

No npm install, server, or custom Actions workflow is needed. `.nojekyll` skips Jekyll processing. The page works under the repository subpath because its scripts, styles, logo and checklist data are embedded; it has no client-side routes requiring a 404 fallback. GitHub Pages does not run `build-checklist.py`: after CSV edits, run it locally and commit the updated `index.html` as well.

Saved answers belong to the browser and origin. Local preview, GitHub Pages and a custom domain have separate storage; use report download/import to move progress. Reports are downloaded locally, not uploaded to GitHub.

See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Progress and reports

Answers for short and extensive are stored separately. Switching versions preserves both, without treating similarly numbered checks as the same test. Reloading resumes the selected version; a new session defaults to Short.

**Download report** creates an HTML report for the active checklist and mode, including attached screenshots. The button stays fixed at the bottom while scrolling, with another download button at the top. After all checks are answered, a large **Checklist finished** panel offers the same action. Completion means answers were recorded, not that all tests passed. **Preview** opens the report summary without downloading. No automatic downloads occur. Unanswered checks remain NOT TESTED; a partial report is labelled as partial. A screenshot still being read does not block navigation or export—let it finish if you want it included.

**Open previous report** restores the matching build and checklist after confirmation. Revised downloads have unique filenames. Import replaces the current saved session, including the other checklist's answers; download both versions first if you want to keep both. Original files remain unchanged. Old reports without an explicit checklist version are classified from their test IDs. Changed instructions reset that check to NOT TESTED; notes and matching screenshots are retained. Invalid files leave the current session intact.

Progress is stored only in the current browser. Different devices, profiles and simultaneous tabs do not synchronise. The total attached-image allowance is 3 MB across both versions in a session. A visible warning appears if browser storage fails.

## Maintenance

- `HUMAN_TEST_CHECKLIST.csv`: short master list, including the other-bugs question.
- `EXTENSIVE_TEST_CHECKLIST.csv`: extensive master list with permanent IDs and regression markers.
- `HUMAN_TEST_PLAN.md`: volunteer instructions.

After editing either CSV, rebuild the embedded data:

```sh
python3 build-checklist.py
```

The build date is `2026-09-28`, fixed for this test round. For a new dated build, update both CSVs' Build Version cells and rebuild. Mode mappings live in the builder. Identical IDs may exist in both catalogues; reports include the checklist version to distinguish them.

Local preview from the new repository root:

```sh
python3 -m http.server 4186 --bind 127.0.0.1
```

Browser checks: run `node tests/browser-check.mjs` with Node 22+, the preview above and a disposable Chrome debugging session on port 9236. `QA_URL` and `CHROME_DEBUG_URL` override those addresses. Checks cover optional inputs/navigation, bug answers, both checklist versions, isolated progress, report export/import, screenshots, responsive layouts, and zero API traffic. They do not play the game or submit scores.

To verify the GitHub Pages repository subpath, serve the parent directory in one terminal:

```sh
python3 -m http.server 4187 --bind 127.0.0.1 --directory ..
```

Then run the same checks against the nested URL (assuming this checkout is named `FasterHorse_QA`):

```sh
QA_URL=http://127.0.0.1:4187/FasterHorse_QA/ node tests/browser-check.mjs
```
