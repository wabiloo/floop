/**
{
    "api":1,
    "name":"Parse JSON string",
    "description":"Turns a parsable string into pretty JSON",
    "author":"Fabre Lambeau",
    "icon":"list.bullet.indent",
    "tags":"json,convert,quote"
}
 **/
function main(state){
    try {
        let inputStr = state.text;
        if(inputStr[0] == "{"){
            inputStr = '"' + inputStr + '"';
        }
        inputStr = JSON.parse(inputStr);
        eval("va = " + inputStr)
        state.text = JSON.stringify(va, null, "\t");
    }
    catch (error){
        state.postError("Unable to parse")
        state.fullText = error
    }
}