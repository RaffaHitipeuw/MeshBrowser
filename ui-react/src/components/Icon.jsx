// Icons.
//
// Plain React SVG icons. The glyph data lives in iconData.js (lucide, ISC) and
// is rendered with the same attributes the old vendor script produced
// (class "icon", stroke-width 1.75), so ui/css/icons.css keeps working. There
// is no runtime icon library and nothing mutates the DOM.
//
// Add a glyph to iconData.js, then use it by name: <Icon name="arrow-left" />.

import { ICON_NODES } from "./iconData.js";

/**
 * @param {{name: string, className?: string, title?: string}} props
 */
export default function Icon({ name, className = "icon", title }) {
  const nodes = ICON_NODES[name];
  if (!nodes) {
    console.warn(`[mesh] unknown icon "${name}"`);
    return null;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {nodes.map(([Tag, attrs], i) => (
        <Tag key={i} {...attrs} />
      ))}
    </svg>
  );
}
