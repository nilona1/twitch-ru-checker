# Twitch RU Checker

A browser extension (Chrome, Manifest V3) that highlights Twitch chat users based on data from a third-party lookup service, [artemiano.top](https://artemiano.top/twitch/). Messages from flagged users get a colored border, a recolored username and a small badge with a tooltip showing the numbers behind the flag.

Also published for Firefox. Works with both the standard Twitch chat and the [7TV](https://7tv.app/) chat extension.

<!-- TODO: add Chrome Web Store and Firefox Add-ons links, and a screenshot -->

## How it works

```
Twitch page (content.js)                 Service worker (background.js)        artemiano.top
  MutationObserver sees a new   ──msg──▶   fetch(`/api/twitch/<username>`)  ──▶  lookup
  chat message                             parse the text response           ◀──
  rate-limited queue + cache    ◀─reply──  { all_count, warning_count,
  highlight message + badge                  bad_count }
```

1. **Content script** (`content.js`) watches the chat with a `MutationObserver` and extracts the username from each new message (standard Twitch markup and 7TV markup).
2. Usernames go into a **queue** processed at one request per 1.5 s, with an in-memory **cache** so each user is checked only once per session.
3. The content script cannot call a third-party origin directly because of **CORS**, so it sends a message to the **background service worker**, which has `host_permissions` for the service and performs the request.
4. The service worker extracts the counters from the service's text response with regular expressions and returns them. The content script then adds a CSS class and a badge to the message row.
5. Twitch is a single-page app, so the script also detects URL changes and resets its queue and observer when you switch channels.

## Tech

- JavaScript (ES2020), no build step, no dependencies
- Chrome Extension Manifest V3: content scripts, service worker, `chrome.runtime` messaging, `host_permissions`
- DOM `MutationObserver`, CSS injection

## Install (from source)

1. Clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `chrome/` folder.
4. Open any Twitch channel with an active chat.

## Project structure

```
chrome/
├── manifest.json    # MV3 manifest, permissions, content script registration
├── background.js    # service worker: network request + response parsing
├── content.js       # chat observer, queue, cache, highlighting
├── styles.css       # highlight styles
├── popup.html       # popup with the colour legend
└── icon16.png, icon48.png
```

## Challenges solved

- **CORS:** moved cross-origin requests from the content script into the service worker.
- **Manifest validation:** fixed Manifest V3 validation errors during store submission.
- **Cross-browser differences:** adapted the extension to differences between Chrome and Firefox extension APIs.
- **Dynamic DOM:** 7TV re-renders chat messages, so highlights are re-applied after DOM changes.
- **Request volume:** a queue with a fixed delay and a cache keep the number of requests to the external service low.

## Limitations and ideas for improvement

- The service has no documented public API, so the extension parses its text response with regular expressions. A change in the service's response format will break parsing; a JSON API and proper error handling would be more robust.
- The cache lives in memory and resets when the page reloads (`chrome.storage` could persist it, which would also require adding the `storage` permission back).
- No automated tests yet. The parsing logic in `background.js` is a good candidate for unit tests with Jest.

## Privacy

To check a user, the extension sends that user's Twitch username (as shown in chat) to artemiano.top. The extension itself collects, stores and transmits nothing else. The results come from the third-party service and are not verified by this project.

## Disclaimer

This project is not affiliated with Twitch, 7TV or artemiano.top. All data comes from artemiano.top.

## License

[MIT](LICENSE)
