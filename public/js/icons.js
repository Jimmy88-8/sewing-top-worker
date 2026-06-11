/**
 * SewingOS app icon set.
 *
 * App icons use the Tahoe assets in /public/icons where available.
 * The remaining icons keep the original inline SVG artwork.
 */

const image = (name) =>
  `<img class="app-ic" src="/icons/${name}.png" alt="" aria-hidden="true" draggable="false">`;

export const ICONS = {
  finder: image("finder"),

  market: image("bloomberg-portal"),

  ibkr: image("ibkr"),

  notes: image("notes"),

  calculator: image("calculator"),

  calendar: image("calendar-tahoe"),

  weather: image("weather"),

  cli: image("terminal"),

  settings: image("settings-tahoe"),

  about: image("about-tahoe"),

  trash: image("trash-full-tahoe"),
};

export const EXTRA_ICONS = {
  activityMonitor: image("activity-monitor-tahoe"),
  apps: image("apps-tahoe-light"),
  bluetooth: image("bluetooth-tahoe"),
  books: image("books-tahoe"),
  claude: image("claude-tahoe"),
  dictionary: image("dictionary-tahoe"),
  discord: image("discord-tahoe"),
  findMy: image("find-my-tahoe"),
  freeform: image("freeform"),
  games: image("games-tahoe"),
  gemini: image("gemini-tahoe"),
  chrome: image("google-chrome-tahoe"),
  googleDocs: image("google-docs-tahoe"),
  googleDrive: image("google-drive-tahoe"),
  google: image("google-tahoe"),
  translate: image("google-translate-tahoe"),
  mail: image("mail-tahoe"),
  maps: image("maps-tahoe"),
  music: image("music-tahoe"),
  notion: image("notion-tahoe"),
  geforceNow: image("nvidia-geforce-now-tahoe"),
  photos: image("photos-tahoe"),
  quicktime: image("quicktime-player-tahoe"),
  reminders: image("reminders-tahoe"),
  rockstar: image("rockstar-games-launcher-tahoe"),
  safari: image("safari-tahoe"),
  screenshot: image("screenshot-tahoe"),
  shortcuts: image("shortcuts-tahoe"),
  spotify: image("spotify-tahoe"),
  timeMachine: image("time-machine-tahoe"),
  widgetsmith: image("widgetsmith-tahoe"),
};

/* Small monochrome glyphs for in-app use (Finder docs, etc.) */
export const GLYPHS = {
  doc: `<img class="glyph-ic" src="/icons/document.png" alt="" aria-hidden="true" draggable="false">`,
  folder: `<img class="glyph-ic" src="/icons/folder-tahoe.png" alt="" aria-hidden="true" draggable="false">`,
};
