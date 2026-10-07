/**
	{
		"api":1,
		"name":"Parse URL",
		"description":"Parse a URL and turn it into a JSON object",
		"author":"Fabre Lambeau",
		"icon":"link",
		"tags":"url,uri"
	}
**/
  
const parseUrl = require('lib/url');

function main(state) {
  const input = (state.text || '').trim();
  const out = parseUrl(input);

  if (!out) {
    state.postError('Not a valid absolute URL');
    return;
  }

  state.text = JSON.stringify(out, null, 2);
}