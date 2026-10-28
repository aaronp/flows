// Builds flows.html: template.html with core.js and ui.js inlined. No dependencies.
// Usage: node build.js
'use strict';
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const t = read('template.html');
for (const mark of ['/*__CORE__*/', '/*__UI__*/']) {
  if (t.split(mark).length !== 2) throw new Error('template.html must contain ' + mark + ' exactly once');
}
// Function replacers so "$" sequences in the sources are kept as-is.
const out = t.replace('/*__CORE__*/', () => read('core.js')).replace('/*__UI__*/', () => read('ui.js'));
fs.writeFileSync(path.join(__dirname, 'flows.html'), out);
console.log('wrote flows.html (' + out.length + ' bytes)');
