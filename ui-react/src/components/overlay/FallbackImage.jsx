// Image with a fallback chain.
//
// The legacy overlay bound an "error" listener to every favicon <img> and
// walked a list of candidate sources before falling back to the brand mark
// (ui/js/overlay.js: bindFavicon). React does the same thing declaratively:
// the failed candidate moves the state forward, the next candidate is used.

import { useEffect, useState } from "react";

import { FALLBACK_FAVICON } from "../../services/overlayController.js";

/**
 * @param {{
 *   sources?: string[],
 *   fallback?: string,
 *   className?: string,
 *   alt?: string,
 *   draggable?: boolean,
 *   referrerPolicy?: string,
 * }} props
 */
export default function FallbackImage({
  sources,
  fallback = FALLBACK_FAVICON,
  className,
  alt = "",
  draggable,
  referrerPolicy = "no-referrer",
}) {
  const list =
    Array.isArray(sources) && sources.length > 0 ? sources.slice() : [fallback];
  const [index, setIndex] = useState(0);

  // A new source list starts over.
  useEffect(() => {
    setIndex(0);
  }, [list.join("|")]);

  const src = index < list.length ? list[index] : fallback;

  return (
    <img
      className={className}
      alt={alt}
      src={src}
      decoding="async"
      draggable={draggable}
      referrerPolicy={referrerPolicy}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
