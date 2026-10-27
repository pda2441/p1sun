// One-time, explicit import of unmodified instructions from the parent workspace.
// Does not execute PowerShell or change its execution policy. Refuses overwrites.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(site, '../..');
const selected = ['frontend-design','web-design-guidelines','playwright','visual-quality-review','fullstack-validation','api-and-integration','environment-recovery'];
const manifest = JSON.parse((await readFile(resolve(workspace,'docs/workspace-manifest.json'),'utf8')).replace(/^\uFEFF/,''));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const imported = [];
const skills = [];
for (const name of selected) {
  const skill = manifest.skills.find(item => item.name === name);
  if (!skill) throw new Error(`Unknown skill: ${name}`);
  for (const file of skill.files) {
    const source = resolve(workspace, skill.package_path, file.path);
    const destination = resolve(site, '.agents/skills', name, file.path);
    if (relative(site,destination).startsWith('..')) throw new Error('Unsafe path');
    const bytes = await readFile(source);
    if (sha(bytes) !== file.sha256) throw new Error(`Source checksum mismatch: ${source}`);
    try { await access(destination); throw new Error(`Refusing overwrite: ${destination}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(dirname(destination),{recursive:true});
    await copyFile(source,destination);
    imported.push({path:relative(site,destination).replaceAll('\\','/'),sha256:file.sha256,immutable:true});
  }
  skills.push({...skill,package_path:`.agents/skills/${name}`,install_path:`.agents/skills/${name}`});
}
for (const agent of manifest.agents) {
  const source = resolve(workspace,agent.package_path);
  const destination = resolve(site,agent.install_path);
  const bytes = await readFile(source);
  if (sha(bytes) !== agent.sha256) throw new Error(`Role checksum mismatch: ${source}`);
  await mkdir(dirname(destination),{recursive:true});
  await copyFile(source,destination);
  imported.push({path:agent.install_path,sha256:agent.sha256,immutable:true});
}
await mkdir(resolve(site,'docs'),{recursive:true});
await writeFile(resolve(site,'docs/skills-lock.json'),JSON.stringify({schema_version:1,skills},null,2)+'\n');
await writeFile(resolve(site,'docs/site-kit-manifest.json'),JSON.stringify({schema_version:1,files:imported},null,2)+'\n');
await copyFile(resolve(workspace,'scripts/Test-SiteKit.ps1'),resolve(site,'scripts/Test-SiteKit.ps1'));
console.log(`Imported ${skills.length} complete skill packages, 5 role configurations; ${imported.length} immutable files verified.`);
