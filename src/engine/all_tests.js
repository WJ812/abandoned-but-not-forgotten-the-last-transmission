/**
 * Node-only test entry. Node 22 runs a directory argument to `node --test`
 * as a single entry point instead of searching it, so src/engine/package.json
 * points "main" here and this file imports every *.test.js in the folder.
 * Not part of the engine runtime; never imported by the game.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.js')).sort()) {
  await import(pathToFileURL(join(dir, f)).href);
}
