# Simplified NTP

A standalone Manifest V3 extension that replaces the new tab page with a copy of
Cromite's Android "Simplified NTP"
(`build/patches/Restore-Simplified-NTP-launch.patch` in the Cromite repo).

What it shows:

- A **Bookmarks** / **Downloads** shortcut row (`ntp_shortcuts.xml`).
- A grid of most-visited sites (`chrome.topSites`), laid out like
  `MostVisitedTilesGridLayout.java`: at most 4 columns, with equal spacing
  between and around the tiles.
  - **Difference from Android:** Android caps the grid at 4 rows. Here rows are
    added until the window is filled with whole rows, so no row is cut off and
    the page never scrolls.
- The "Nothing to see here… yet" placeholder when there are no tiles
  (the image is taken from the patch).
- A right-click (or long-press) menu on each tile: *Open in new tab*,
  *Open in new window* and *Remove*. Remove shows an *Undo* snackbar.
  Removed sites are saved in `chrome.storage.local`.
- No search box and no logo, as in Cromite.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open a new tab.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Overrides the new tab page; permissions `topSites`, `favicon`, `storage` |
| `newtab.html` / `newtab.css` | Page markup and styling (light and dark) |
| `newtab.js` | Tiles, grid layout, context menu, removal with undo |
| `_locales/en/messages.json` | Strings (taken from the Android string resources) |
| `images/` | Placeholder image and extension icons |

Favicons come from the extension `_favicon` endpoint. When the browser only
has its generic globe icon for a site, the tile shows a grey letter icon
instead, like Chromium's fallback.
