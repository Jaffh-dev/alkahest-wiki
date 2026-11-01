# Alkahest Wiki

Documentation site for the Alkahest family of Minecraft mods, published with GitHub Pages. Plain HTML, CSS and
JavaScript: no build step, no framework, no dependencies.

Each mod has a landing page with a version selector, and per version two guides: one for **datapack creators** and one
for **mod developers**.

## Viewing it locally

Open `index.html` in a browser. Everything uses relative paths and classic scripts, so it also works from the file
system. To test it as GitHub Pages serves it, run a static server from this folder, for example
`python -m http.server 8000`, and open <http://localhost:8000>.

## Layout

```
index.html                         Home: one card per mod
assets/
  css/global.css                   Shared design: colors (light and dark), header, code blocks, tables, callouts
  css/home.css                     Home page
  css/mod.css                      Mod landing pages
  css/docs.css                     Doc pages: sidebar, content, "On this page", previous / next
  js/core/theme.js                 Light / dark theme (loaded in <head> so the page never flashes)
  js/core/site.js                  Header, footer, code highlighting and copy buttons (every page)
  js/core/versions.js              Version selector (mod landing and doc pages)
  js/core/docs.js                  Sidebar, table of contents, previous / next, mobile menu (doc pages)
  js/data/mods.js                  Registry of mods and their versions
  js/pages/*.js                    One entry script per page; doc pages without their own behavior share doc-page.js
  img/                             Site logo and mod icons
mods/<mod-id>/
  index.html                       Mod landing page
  <version>/nav.js                 Page list of that version (sidebar order)
  <version>/datapacks/*.html       Datapack guide
  <version>/developers/*.html      Developer guide
```

Rules: every page is its own HTML file; no `<style>`, `style=""`, inline `<script>` or `on…=""` handlers in HTML.
Shared CSS goes in `global.css`, page-type CSS in its own file. Each page loads one entry script from `js/pages/`.

Each page describes itself with attributes on `<html>`, which the scripts read:

| Attribute      | Meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| `data-root`    | Relative path to the site root (`../../../../` in doc pages)   |
| `data-mod`     | Mod id from `mods.js`                                          |
| `data-version` | Version folder name (doc pages)                                |
| `data-section` | `datapacks` or `developers` (doc pages)                        |
| `data-page`    | File name without `.html`, as listed in `nav.js` (doc pages)   |

## Adding a page

1. Copy an existing page of the same section, such as `mods/alkahest-drops/1.20.1-1.0.0/datapacks/jei.html`.
2. Change `data-page`, `<title>`, the description and the `<article>` content.
3. Add it to the version's `nav.js` in the group where it belongs.

Code blocks: `<pre data-title="optional label"><code data-lang="json">…</code></pre>`. Languages: `json`, `java`,
`gradle`, `toml`, `mcfunction`, `command`. Escape `<`, `>` and `&` inside code as `&lt;`, `&gt;`, `&amp;`.

## Adding a version of a mod

1. Copy the latest version folder, for example `mods/alkahest-drops/1.20.1-1.0.0` to `mods/alkahest-drops/1.20.1-1.1.0`.
2. In the copied pages, replace `data-version="1.20.1-1.0.0"` with the new id.
3. In the copied `nav.js`, change the version in `registerNav(...)`.
4. In `assets/js/data/mods.js`, add the version at the top of `versions`, move `latest: true` to it and list its
   highlights.
5. Edit what changed. The version selector opens the same page in another version when it exists there, and the
   guide's first page otherwise.

## Adding a mod

1. Add an entry to `assets/js/data/mods.js` (id, name, texts, icon, path, sections, versions). The home page card
   appears by itself.
2. Add its icon to `assets/img/mods/`.
3. Copy `mods/alkahest-drops/index.html` to `mods/<mod-id>/index.html` and change `data-mod`, the title, the texts and
   the icon. `mod-landing.js` works for every mod.
4. Create `mods/<mod-id>/<version>/nav.js` and its pages as above.

## Publishing with GitHub Pages

Push to GitHub, then in the repository settings choose **Pages → Deploy from a branch → `main` / root**. The empty
`.nojekyll` file makes GitHub serve the files as they are.

## License

Copyright (C) 2026 Jaffh. The documentation text describes the Alkahest mods, which have their own licenses.
