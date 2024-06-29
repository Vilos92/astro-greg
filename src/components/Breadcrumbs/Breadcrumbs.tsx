/*
 * Types.
 */

interface BreadcrumbsProps {
  currentPath: string;
}

/*
 * Component.
 */

export default function Breadcrumbs(props: BreadcrumbsProps) {
  const pathParts = props.currentPath.split('/').filter(Boolean);
  const breadCrumbs = pathParts.map(crumb => (crumb ? crumb : 'Home'));

  return (
    <nav className="mb-4">
      {breadCrumbs.length > 0 ? <a href="/">Home</a> : <span className="italic">Home</span>}
      {breadCrumbs.map((crumb, index) => renderBreadCrumb(breadCrumbs, crumb, index))}
    </nav>
  );
}

/*
 * Helpers.
 */

function renderBreadCrumb(breadCrumbs: ReadonlyArray<string>, crumb: string, index: number) {
  if (index === breadCrumbs.length - 1) {
    return (
      <span>
        {' '}
        &#62; <span className="italic">{titleCase(crumb)}</span>
      </span>
    );
  }

  return (
    <span>
      {' '}
      &#62; <a href={`/${breadCrumbs.slice(0, index + 1).join('/')}/`}>{titleCase(crumb)}</a>
    </span>
  );
}

function titleCase(crumb: string) {
  return crumb
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
