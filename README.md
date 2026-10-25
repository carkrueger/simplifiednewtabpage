# Simplified NTP

A standalone Manifest V3 extension that replaces the new tab page with a copy of
Cromite's Android "Simplified NTP"
(`build/patches/Restore-Simplified-NTP-launch.patch` in the Cromite repo).

## Install in Titanium Browser (Android)

[Titanium](https://github.com/jqssun/android-titanium-browser) only installs
extensions from websites when they come from the Chrome Web Store or the Opera
or Edge add-on stores. Tapping the `.crx` on the release page just downloads
it, so install it from the downloaded file instead:

1. Download `simplified-ntp-<version>.crx` (or the `.zip`) from the
   [latest release](https://github.com/carkrueger/simplifiednewtabpage/releases/latest).
2. Open the menu, then **Extensions** → **Manage extensions**
   (or go to `chrome://extensions`).
3. Find **Titanium Extension**, tap **Details**, then **Extension options**.
4. Install the downloaded file from the local file option on that page.
5. Open a new tab.

**Titanium Extension** is built into Titanium. If it isn't in your list, see
[android-titanium-extension](https://github.com/jqssun/android-titanium-extension)
for how to install it.

Alternatively, unzip `simplified-ntp-<version>.zip`, then in
`chrome://extensions` turn on **Developer mode**, tap **Load unpacked** and
choose the unzipped folder.

## What it shows

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

Packed builds are on the [Releases](../../releases) page:

- `.crx`: drag it onto `chrome://extensions`. Browsers that block installing
  extensions from outside the Web Store, such as Google Chrome, won't accept it.
- `.zip`: unpack it and use **Load unpacked**, or upload it to the Chrome Web
  Store.

## Releasing

Releases are built by [`.github/workflows/release.yml`](.github/workflows/release.yml).
Pushing a tag such as `v1.2.3` sets that version in the manifest, packs the
extension and publishes a GitHub release with the `.crx` and `.zip` attached.

```sh
git tag v1.0.0
git push origin v1.0.0
```

The `.crx` is signed with the RSA key in the `CRX_PRIVATE_KEY` repository
secret. The key decides the extension ID, so keep using the same one. To
create it once:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out key.pem
gh secret set CRX_PRIVATE_KEY < key.pem
```

Keep `key.pem` somewhere safe outside the repository.

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

## License

[GPL-3.0](LICENSE). The page reproduces Cromite's
`Restore-Simplified-NTP-launch.patch` (GPL-3.0-only), which is based on
Chromium code under a BSD-style license. The grid layout is ported from
`MostVisitedTilesGridLayout.java`, and the placeholder image and strings come
from that patch.
