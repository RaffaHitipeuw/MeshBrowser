// The start page of the shell.
//
// Port of the #browser-start markup of ui/index.html. The statistics card
// stays hidden, exactly like the legacy page (its toggle button was
// commented out there as well).

import { formatCount } from "../../services/shell/adblock.js";

export default function StartPage({ blockedTotal = 0, hidden = false }) {
  return (
    <div className="browser-start" id="browser-start" hidden={hidden}>
      <div className="browser-start-stats">
        <div
          className="browser-start-stats-card"
          id="browser-start-stats-card"
          role="status"
          hidden
        >
          <div className="browser-start-stats-card-label">Blocked so far</div>
          <div className="browser-start-stats-card-value" id="browser-start-stats-value">
            {formatCount(blockedTotal)}
          </div>
          <div className="browser-start-stats-card-sub">trackers, ads, and more</div>
        </div>
      </div>
    </div>
  );
}
