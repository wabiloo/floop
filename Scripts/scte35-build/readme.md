To build the SCTE35 script for Boop:

```
npm i -D browserify
npm i github:wabiloo/scte35-js-annotated#main

npx browserify decode-scte35.js -o ../decodeScte35.js

node patch-boop-script.js
```

The last script is a patch to make the code work in the browser.
Then, as per the instructions in [the Boop docs](https://github.com/IvanMathy/Boop/blob/main/Boop/Documentation/ConvertingNodeModules.md), add the following line to the generated `decodeScte35.js` file:

```
const window = this;
```

As well as the declaration:

```
/**
  {
    "api":1,
    "name":"Decode SCTE-35",
    "description":"Parse base-64 or hex SCTE-35 cue into JSON",
    "author":"Fabre Lambeau",
    "icon":"tag",
    "tags":"scte35,parse"
  }
**/
```

