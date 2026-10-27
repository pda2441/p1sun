// Maintainer-only: run after an intentional asset change, never to hide a mismatch.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function walk(directory){for(const item of await readdir(directory,{withFileTypes:true})){const file=resolve(directory,item.name);if(item.isDirectory())await walk(file);else files.push({path:relative(root,file).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}}
await walk(resolve(root,'assets'));
await writeFile(resolve(root,'docs/assets-manifest.json'),JSON.stringify({schema_version:1,created:'2026-10-25',files},null,2)+'\n');
console.log(`Recorded ${files.length} asset SHA-256 checksums.`);
