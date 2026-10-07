/**
{
    "api":1,
    "name":"JSON to string",
    "description":"Turns a JSON object into a string",
    "author":"Fabre Lambeau",
    "icon":"quote",
    "tags":"json,convert,quote,stringify"
}
 **/
function main(state){
    try {
        let inputStr = state.text;        
        inputObj = JSON.parse(inputStr);

        state.text = JSON.stringify(JSON.stringify(inputObj));
    }
    catch (error){
        state.postError(error)
    }
}