// The "Agent Controlled" pill.
//
// Port of the agent HUD of ui/js/features/browser/browser.js: the pill is
// shown while the agent works, it shows the number of agents and the button
// pauses ("Take Control") or resumes them.

import Icon from "../Icon.jsx";
import { bridge } from "../../services/bridge.js";

export default function AiControlPill({ active, paused, agentCount }) {
  const label = paused
    ? "Agents Paused"
    : agentCount > 1
    ? `${agentCount} Agents`
    : "Agent Controlled";
  const buttonLabel = paused ? "Resume" : "Take Control";

  return (
    <div
      className="ai-control-pill"
      id="ai-control-pill"
      role="status"
      aria-live="polite"
      hidden={!active}
    >
      <div className="ai-control-pill-content">
        <span className="ai-control-pill-text">{label}</span>
      </div>
      <button
        type="button"
        className="ai-control-pill-btn"
        id="ai-control-pause-btn"
        aria-label={paused ? "Resume agents" : "Take Control"}
        onClick={() => {
          const action = paused ? bridge.agentResume() : bridge.agentPause();
          action.catch(() => {});
        }}
      >
        <span className="ai-control-pill-btn-icon" id="ai-control-btn-icon">
          <Icon name="hand" />
        </span>
        <span>{buttonLabel}</span>
      </button>
    </div>
  );
}
