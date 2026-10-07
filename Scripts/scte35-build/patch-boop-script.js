const fs = require('fs');
const path = require('path');

const targetFilePath = path.join(__dirname, '..', 'decodeScte35.js');

const boopDeclaration = `/**
  {
    "api":1,
    "name":"Decode SCTE-35",
    "description":"Parse base-64 or hex SCTE-35 cue into JSON",
    "author":"Fabre Lambeau",
    "icon":"tag",
    "tags":"scte35,parse"
  }
**/
`;

const windowConst = 'const window = this;';

// Check if the target file exists
if (!fs.existsSync(targetFilePath)) {
  console.error(`Error: Target file not found at ${targetFilePath}`);
  process.exit(1);
}

try {
  // Read the original content
  const originalContent = fs.readFileSync(targetFilePath, 'utf8');

  // Prepend the declaration and the constant
  const newContent = `${boopDeclaration}\n\n${windowConst}\n\n${originalContent}`;

  // Write the modified content back to the file
  fs.writeFileSync(targetFilePath, newContent, 'utf8');

  console.log(`Successfully patched ${targetFilePath}`);
} catch (err) {
  console.error(`Error patching file: ${err}`);
  process.exit(1);
} 