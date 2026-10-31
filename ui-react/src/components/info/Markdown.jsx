// A tiny Markdown renderer for the update notes.
//
// The legacy ui/js/info.js rendered the update notes by building an HTML
// string and assigning it to `innerHTML`. That is not possible inside a
// React-owned tree, so the same grammar is rendered here as React
// elements: the produced DOM matches the legacy markup.
//
// Supported: ATX headings (#..###), unordered and ordered lists, GFM
// tables and paragraphs. Inline: `code`, **strong**, *emphasis* and
// [links](https://…).

import React from "react";

const LIST_RE = /^[-*]\s+/;
const ORDERED_RE = /^\d+\.\s+/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const TABLE_SEPARATOR_RE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/;
const INLINE_RE =
  /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/** Renders the inline spans of one Markdown line. */
export function renderInline(text, keyPrefix = "i") {
  const source = String(text == null ? "" : text);
  const nodes = [];
  let last = 0;
  let match;
  let index = 0;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(source)) !== null) {
    if (match.index > last) {
      nodes.push(source.slice(last, match.index));
    }
    const key = `${keyPrefix}-${index}`;
    index += 1;
    if (match[1] !== undefined) {
      nodes.push(<code key={key}>{match[1]}</code>);
    } else if (match[2] !== undefined) {
      nodes.push(
        <a key={key} href={match[3]} target="_blank" rel="noopener noreferrer">
          {match[2]}
        </a>
      );
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else {
      nodes.push(<em key={key}>{match[5]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    nodes.push(source.slice(last));
  }
  return nodes;
}

function splitRow(row) {
  return String(row)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Renders a Markdown document as a list of React elements.
 *
 * @param {string} source
 * @returns {React.ReactNode[]}
 */
export function renderMarkdown(source) {
  const lines = String(source || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const parts = [];
  let i = 0;
  let key = 0;

  const nextKey = () => {
    key += 1;
    return `md-${key}`;
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      parts.push(
        <Tag key={nextKey()}>{renderInline(heading[2].trim(), nextKey())}</Tag>
      );
      i += 1;
      continue;
    }

    if (LIST_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && LIST_RE.test(lines[i].trim())) {
        const text = lines[i].trim().replace(LIST_RE, "");
        items.push(<li key={nextKey()}>{renderInline(text, nextKey())}</li>);
        i += 1;
      }
      parts.push(<ul key={nextKey()}>{items}</ul>);
      continue;
    }

    if (ORDERED_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && ORDERED_RE.test(lines[i].trim())) {
        const text = lines[i].trim().replace(ORDERED_RE, "");
        items.push(<li key={nextKey()}>{renderInline(text, nextKey())}</li>);
        i += 1;
      }
      parts.push(<ol key={nextKey()}>{items}</ol>);
      continue;
    }

    // GFM table: header | --- | rows
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      TABLE_SEPARATOR_RE.test(lines[i + 1].trim())
    ) {
      const header = splitRow(trimmed);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        bodyRows.push(splitRow(lines[i].trim()));
        i += 1;
      }
      parts.push(
        <div className="info-table-wrap" key={nextKey()}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`th-${cellIndex}`}>{renderInline(cell, `th${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`td-${rowIndex}-${cellIndex}`}>
                      {renderInline(cell, `td${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraph = [];
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        HEADING_RE.test(next) ||
        LIST_RE.test(next) ||
        ORDERED_RE.test(next) ||
        (next.includes("|") &&
          i + 1 < lines.length &&
          TABLE_SEPARATOR_RE.test(lines[i + 1].trim()))
      ) {
        break;
      }
      paragraph.push(next);
      i += 1;
    }
    const text = paragraph.join(" ").trim();
    if (text) {
      parts.push(<p key={nextKey()}>{renderInline(text, nextKey())}</p>);
    }
  }

  return parts;
}

export default renderMarkdown;
