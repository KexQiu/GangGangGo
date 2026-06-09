type RedirectEvent = {
  initial: boolean;
  path: string | null;
};

export function redirectSystemPath({ path }: RedirectEvent): string | null {
  if (!path) {
    return path;
  }

  return normalizeInvitePath(path) ?? path;
}

function normalizeInvitePath(path: string) {
  const segments = getPathSegments(path);

  if (segments[0] === 'team-invites' && segments[1]) {
    return `/team/join/${segments[1]}`;
  }

  if (segments[0] === 'team' && segments[1] === 'join' && segments[2]) {
    return `/team/join/${segments[2]}`;
  }

  return null;
}

function getPathSegments(path: string) {
  try {
    const url = new URL(path);

    if (url.protocol !== 'xiaotidu:') {
      return pathToSegments(url.pathname);
    }

    return [url.hostname, ...pathToSegments(url.pathname)].filter(Boolean);
  } catch {
    return pathToSegments(path);
  }
}

function pathToSegments(path: string) {
  return path.split(/[?#]/)[0].split('/').filter(Boolean);
}
