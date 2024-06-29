// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Greg Linscheid';
export const SITE_DESCRIPTION = 'A personal website for Greg Linscheid';

export function formatTitle(pageTitle: string) {
  return `${SITE_TITLE} | ${pageTitle}`;
}
