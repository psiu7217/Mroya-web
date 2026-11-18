# Mobile browser appearance

`index.html` provides OS-matched first-paint theme-color candidates. The shared
`applyBrowserTheme()` updates both candidates from the resolved application
appearance, including manual overrides of the OS. `data-theme` also controls CSS
`color-scheme` and the existing page backgrounds. Guest and live layouts use
`useWorkspaceLayout`; Studio uses the same browser-theme function. The last
resolved appearance remains applied while a workspace unmounts for session loading.
Reloaded account appearance still comes from the existing profile/session flow;
guest appearance still uses the existing guest preference. No new storage is added.

The viewport, safe-area behavior, keyboard visualViewport handling and drawer
navigation are unchanged. There is an Apple Touch Icon, but no configured web-app
manifest or `apple-mobile-web-app-capable` mode. This change does not enable
standalone/fullscreen or add `black-translucent` overlays. iOS versions may offer
user-controlled Add to Home Screen / Open as Web App independently of these tags.

Safari 26 can derive its tint from rendered page/fixed-edge backgrounds rather
than honor theme-color. The theme already paints html, body, #root, Workspace and
headers using Mroya tokens; their geometry and Studio colors are retained.
Browser/OS chrome and clock/battery/Wi-Fi contrast remain controlled by iOS.
See [WebKit's tint explanation](https://bugs.webkit.org/show_bug.cgi?id=301756#c2)
and [Apple's standalone status-bar metadata reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html).

For physical-device release review, check Safari normal tabs, an existing home
screen launch if used, and iOS Chrome / Android Chrome: toggle Light/Dark/System,
change the OS appearance while System is selected, reload/reopen, and inspect
indicator contrast, notch/Dynamic Island, keyboard and drawer gestures. Also check
manual Light against a dark OS and manual Dark against a light OS. Record actual
iOS/browser versions. DOM assertions and desktop viewport resizing cannot confirm
native status-bar rendering or a physical software keyboard.
