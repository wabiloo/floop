/**
  {
    "api":1,
    "name":"Duration ↔︎ Float (s)",
    "description":"Convert between seconds (float) and HH:MM:SS.mmm",
    "author":"Fabre Lambeau",
    "icon":"stopwatch",
    "tags":"time,duration"
  }
**/

function main(state) {
  const txt = state.text.trim();

  // 1) Float seconds  →  HH:MM:SS.mmm
  if (/^\d+(?:\.\d+)?$/.test(txt)) {
    const t = parseFloat(txt);
    if (isNaN(t)) return state.postError('Not a number');

    let ms  = Math.round((t % 1) * 1000);
    let sec = Math.floor(t) % 60;
    let min = Math.floor(t / 60) % 60;
    let hr  = Math.floor(t / 3600);

    // handle rounding overflow (e.g. 59.9995 → 1:00.000)
    if (ms === 1000) { ms = 0; sec += 1; }
    if (sec === 60)  { sec = 0; min += 1; }
    if (min === 60)  { min = 0; hr  += 1; }

    const pad = (n, w) => String(n).padStart(w, '0');
    state.text =
      `${pad(hr,2)}:${pad(min,2)}:${pad(sec,2)}.${pad(ms,3)}`;
    return;
  }

  // 2) HH:MM:SS[.mmm]  →  float seconds
  const m = /^(\d{1,2}):([0-5]?\d):([0-5]?\d)(?:\.(\d{1,3}))?$/.exec(txt);
  if (m) {
    const [ , h, mn, s, msRaw = '0' ] = m;
    const ms = parseInt((msRaw + '000').slice(0,3), 10); // normalize to ms
    const secs = (+h * 3600) + (+mn * 60) + (+s) + ms / 1000;
    state.text = secs.toFixed(ms ? 3 : 0).replace(/\.?0+$/, ''); // trim trailing zeros
    return;
  }

  state.postError('Input must be float seconds or HH:MM:SS[.mmm]');
}