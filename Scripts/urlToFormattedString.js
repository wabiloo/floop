/**
  {
    "api":1,
    "name":"Pretty-print URL",
    "description":"Break a full HTTP URL into origin, path and aligned query params",
    "author":"Fabre Lambeau",
    "icon":"link",
    "tags":"url,pretty,format"
  }
**/

// Re-use the tiny parser from lib/url.js created earlier
const parseUrl = require('lib/url');


function main(state) {
    const u = parseUrl(state.text.trim());
    if (!u) { state.postError('Not a valid absolute URL'); return; }
  
    const out = [];
    out.push(`${u.protocol}://${u.host}`);                       // base
  
    const IND_PATH  = '   ';
    const IND_QUERY = '     ';
  
    u.pathname.split('/').filter(Boolean)
              .forEach(seg => out.push(`${IND_PATH}/${seg}`));   // path
  
    const entries = Object.entries(u.query);
    if (entries.length) {
      const width = Math.max(...entries.map(([k]) => k.length)); // longest key
      entries.forEach(([k, v], i) => {
        const prefix = i === 0 ? '? ' : '& ';
        out.push(
          `${IND_QUERY}${prefix}${k.padEnd(width)} = ${v}`       // aligned
        );
      });
    }
  
    state.text = out.join('\n');
  }