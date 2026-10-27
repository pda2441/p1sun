import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const report = (condition, message) => { console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`); if (!condition) failures += 1; };
const html = await readFile(resolve(root, 'index.html'), 'utf8');
report(/<html[^>]+lang=["']ru["']/.test(html), 'Язык страницы — русский');
report(/<title>[^<]*Золотая Лоза/.test(html), 'Уникальный title с названием ресторана');
report(/name=["']description["']/.test(html), 'Description присутствует');
report(/property=["']og:title["']/.test(html), 'Share-метаданные присутствуют');
for (const page of ['home', 'menu', 'atmosphere', 'booking']) report(html.includes(`data-page="${page}"`), `Раздел ${page}`);
const sources = [...html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)].map(match => match[1]).filter(source => !/^(https?:|mailto:|tel:|data:)/.test(source));
for (const source of new Set(sources)) {
  try { report((await stat(resolve(root, source))).isFile(), `Локальный ресурс ${source}`); }
  catch { report(false, `Локальный ресурс ${source}`); }
}
for (const file of ['js/app.js', 'js/dishes.js', 'scripts/server.mjs']) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
  report(result.status === 0, `Синтаксис ${file}`);
  if (result.status !== 0) console.error(result.stderr);
}
const { dishes } = await import('../js/dishes.js');
report(dishes.length >= 10 && dishes.length <= 12, '10–12 блюд в едином источнике');
report(new Set(dishes.map(dish => dish.id)).size === dishes.length, 'Уникальные ID блюд');
for (const dish of dishes) {
  report(Boolean(dish.name && dish.description && dish.ingredients?.length && dish.allergens && dish.weight && dish.price > 0), `Данные блюда ${dish.id}`);
  try { report((await stat(resolve(root, dish.image))).isFile(), `Фото блюда ${dish.id}`); }
  catch { report(false, `Фото блюда ${dish.id}`); }
}
for (const [manifestPath, immutableOnly] of [['docs/site-kit-manifest.json', true], ['docs/assets-manifest.json', false]]) {
  const manifest = JSON.parse((await readFile(resolve(root, manifestPath), 'utf8')).replace(/^\uFEFF/, ''));
  const files = manifest.files.filter(file => !immutableOnly || file.immutable);
  let valid = 0;
  for (const file of files) {
    try {
      const content = await readFile(resolve(root, file.path));
      const digest = createHash('sha256').update(content).digest('hex');
      if (digest === file.sha256) valid += 1;
      else report(false, `SHA-256 не совпадает: ${file.path}`);
    } catch { report(false, `Файл манифеста недоступен: ${file.path}`); }
  }
  report(valid === files.length && valid > 0, `${manifestPath}: ${valid}/${files.length} SHA-256`);
}
console.log(`Проверка завершена: ${failures} ошибок. Браузерные сценарии проверяются отдельно.`);
process.exitCode = failures ? 1 : 0;
