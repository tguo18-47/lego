'use strict';
const path = require('node:path');
require('esbuild').buildSync({
  entryPoints:[path.join(__dirname, 'navigation.js')],
  outfile:path.join(__dirname, 'generated/navigation.bundle.js'),
  bundle:true,
  format:'iife',
  globalName:'LegoNavigation',
  target:'es2020',
  minify:true,
  legalComments:'inline',
  logLevel:'warning'
});
