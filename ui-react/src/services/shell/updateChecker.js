// Update checker of the shell.
//
// Port of ui/js/features/browser/update-checker.js: the GitHub release
// lookup, the SemVer comparison, the release-notes formatting and the
// native update flyout.
//
// The legacy module looked for `#browser-update-wrap` / `#browser-update-btn`,
// which do NOT exist in ui/index.html — the update button never rendered in
// the shell (ui/css/update.css expects `.topbar-update-wrap` /
// `.topbar-btn-update` instead, so the markup was renamed at some point and
// the module was left behind). The check itself is ported here and the state
// is exposed; the button is not part of the React tree so the visible button
// set of the shell stays exactly what the legacy UI showed.

import { bridge } from "../bridge.js";

const REPO = "/MeshEngine";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 300;
const UPDATE_FLYOUT_WIDTH = 320;

let currentAppVersion = "0.1.1";
let devMode = false;
let activeRelease = null;

const listeners = new Set();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[mesh] update checker listener failed", err);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return version;
}

/** The release that is currently offered (null when up to date). */
export function getActiveRelease() {
  return activeRelease;
}

export function isUpdateAvailable() {
  return Boolean(activeRelease);
}

export function parseSemVer(value) {
  if (!value) return [0, 0, 0];
  const cleaned = String(value).trim().replace(/^v/i, "");
  const parts = cleaned.split(/[-+.]/).slice(0, 3).map((part) => {
    const num = parseInt(part, 10);
    return Number.isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) parts.push(0);
  return parts;
}

/** True when the release is newer than the installed version. */
export function isNewer(latestStr, currentStr) {
  const latest = parseSemVer(latestStr);
  const current = parseSemVer(currentStr);
  for (let i = 0; i < 3; i += 1) {
    if (latest[i] > current[i]) return true;
    if (latest[i] < current[i]) return false;
  }
  return false;
}

export function formatReleaseNotes(body) {
  if (!body || !body.trim()) {
    return "A new version of Mesh Engine is ready for download. Click below to view the release details and install the update.";
  }
  const clean = body
    .replace(/###\s+/g, "")
    .replace(/##\s+/g, "")
    .replace(/#\s+/g, "")
    .replace(/[*_`]/g, "")
    .trim();
  if (clean.length > 240) {
    return `${clean.slice(0, 237)}...`;
  }
  return clean;
}

export async function getCurrentVersion() {
  try {
    const info = await bridge.appInfo();
    if (info && info.version) {
      currentAppVersion = info.version;
      devMode = Boolean(info.devMode);
    }
  } catch (_) {
    // Keep the default version.
  }
  return currentAppVersion;
}

/**
 * Checks GitHub for a newer release.
 * @returns {Promise<object|null>} the release, or null when up to date
 */
export async function checkForUpdates() {
  const current = await getCurrentVersion();

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: "application/vnd.github.v3+json" },
      cache: "no-store",
    });

    if (!response.ok) {
      activeRelease = null;
      notify();
      return null;
    }

    const release = await response.json();

    const packageAsset = Array.isArray(release?.assets)
      ? release.assets.find((asset) =>
          /^MeshEngine-v[0-9]+\.[0-9]+\.[0-9]+-windows-x64\.zip$/i.test(
            asset.name || ""
          )
        )
      : null;

    const sha256 =
      String(packageAsset?.digest || "").match(
        /^sha256:([a-f0-9]{64})$/i
      )?.[1] || "";

    if (
      !release?.tag_name ||
      !packageAsset?.browser_download_url ||
      !sha256 ||
      !isNewer(release.tag_name, current)
    ) {
      activeRelease = null;
      notify();
      return null;
    }

    release.downloadUrl = packageAsset.browser_download_url;
    release.downloadSha256 = sha256;

    activeRelease = release;
    notify();
    return release;
  } catch (_) {
    activeRelease = null;
    notify();
    return null;
  }
}

export function openFlyout(anchorRect) {
  if (!activeRelease) {
    return Promise.resolve(false);
  }
  const rect = anchorRect || {
    left: window.innerWidth - UPDATE_FLYOUT_WIDTH - 8,
    right: window.innerWidth - 8,
    top: 36,
    bottom: 64,
  };
  let right = Math.round(rect.right);
  right = Math.max(
    UPDATE_FLYOUT_WIDTH + 8,
    Math.min(right, window.innerWidth - 8)
  );
  return bridge
    .overlayShow({
      anchorRight: right,
      anchorTop: Math.round(rect.bottom + 8),
      width: UPDATE_FLYOUT_WIDTH,
      height: 0,
      payload: {
        view: "update",
        version: activeRelease.tag_name || "New Version",
        notes: formatReleaseNotes(activeRelease.body),
        releaseUrl: activeRelease.html_url || `https://github.com/${REPO}/releases`,
        downloadUrl:
          (activeRelease.assets &&
            activeRelease.assets.find((asset) =>
              /^MeshEngine-v[0-9]+\.[0-9]+\.[0-9]+-windows-x64\.zip$/i.test(asset.name || "")
            )?.browser_download_url) ||
          "",
        sha256: activeRelease.downloadSha256 || "",
      },
    })
    .then(() => true)
    .catch(() => false);
}

export function closeFlyout() {
  return bridge.overlayHide().catch(() => {});
}

/** Starts the periodic check (called once when the shell mounts). */
export function startUpdateChecker() {
  window.setTimeout(() => {
    checkForUpdates().catch(() => {});
  }, INITIAL_DELAY_MS);
  const timer = window.setInterval(() => {
    checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);
  return () => window.clearInterval(timer);
}
