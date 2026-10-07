// pull the parser
const { SCTE35 } = require('scte35-annotated');

// the function Boop will call
global.main = function (state) {
  let tag = state.text.trim();
  const parser = new SCTE35();
  let isHex = false;

  try {
    // Check for and remove "0x" prefix if present
    if (tag.startsWith('0x')) {
      tag = tag.substring(2);
      isHex = /^[0-9A-Fa-f]+$/.test(tag);
    } else {
      isHex = /^[0-9A-Fa-f]+$/.test(tag);
    }

    // Parse based on detected encoding
    const result = isHex
      ? parser.parseFromHex(tag)
      : parser.parseFromB64(tag);

    state.text = JSON.stringify(result, null, 2);
  } catch (err) {
    state.postError('Invalid SCTE-35 payload');
    state.text = err.message;
  }
};