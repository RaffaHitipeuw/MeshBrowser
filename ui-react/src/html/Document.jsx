// The document shell of every page, written in JSX.
//
// Rendered to a static string at build time (never in the browser) and written
// to ui/<page>.html. The inline <script> in <head> is the theme bootstrap; it
// must stay inline and synchronous so the theme is set before the first paint.

/**
 * @param {{
 *   page: import("./pages.js").PAGES[number],
 *   bootScript: string,
 * }} props
 */
export default function Document({ page, bootScript }) {
  const call = `MeshBoot.boot(${JSON.stringify({ privateAware: !!page.privateAware })});`;
  // "</script" inside the inlined code would end the tag early.
  const inline = (bootScript + "\n" + call).replace(/<\/script/gi, "<\\/script");

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{page.title}</title>
        <script dangerouslySetInnerHTML={{ __html: inline }} />
        {page.css.map((name) => (
          <link key={name} rel="stylesheet" href={`css/${name}.css`} />
        ))}
      </head>
      <body>
        <div id={page.rootId} />
        <script src={`js/generated/${page.bundle}.js`} />
      </body>
    </html>
  );
}
