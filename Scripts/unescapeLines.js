/**
	{
		"api":1,
		"name":"Unescape Newlines",
		"description":"Converts \\n into real newlines in stringified text.",
		"author":"Fabre Lambeau",
		"icon":"paragraph",
		"tags":"text,newlines,escape"
	}
**/

function main(state) {
	const input = state.text || '';
	state.text = input.replace(/\\n/g, '\n');
}