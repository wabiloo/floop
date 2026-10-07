// Minimal, zero-dep URL parser for Boop
// Usage: const parts = parseUrl("https://user:pw@host:8080/p/a?x=1#top")

function parseQuery(q) {
  if (!q) return {};
  return q.slice(1)            // drop leading '?'
          .split('&')
          .filter(Boolean)
          .reduce((o,p) => {
            const [k,v=''] = p.split('=');
            o[decodeURIComponent(k)] = decodeURIComponent(v);
            return o;
          }, {});
}

module.exports = function parseUrl(u) {
  const m = u.match(
    /^([a-z][a-z0-9+.-]*):\/\/(?:([^:@/]+)(?::([^@/]+))?@)?([^/:?#]+)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i
  );
  if (!m) return null;

  const [
    , protocol, username, password, hostname, port,
    pathname = '/', search = '', hash = ''
  ] = m;

  return {
    href: u,
    protocol,
    username: username || null,
    password: password || null,
    host: port ? `${hostname}:${port}` : hostname,
    hostname,
    port: port || null,
    pathname,
    search,
    hash,
    query: parseQuery(search)
  };
};