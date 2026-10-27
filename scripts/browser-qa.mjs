// Dependency-free QA fallback when the npm registry is unavailable.
// Requires an already running local Edge/Chrome with --remote-debugging-port=9222.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'output/playwright');
await mkdir(output, { recursive: true });
// Each run owns a fresh tab so another agent's review cannot change this page.
const tab = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
if (!tab.webSocketDebuggerUrl) throw new Error('No browser page found on the local debugging port');
await fetch(`http://127.0.0.1:9222/json/activate/${tab.id}`);
await new Promise(resolveReady => setTimeout(resolveReady, 250));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let nextId = 1;
const waiting = new Map();
const errors = [];
const responses = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) pending?.reject(new Error(`${pending.method}: ${message.error.message}`));
    else pending?.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
  if (message.method === 'Network.responseReceived') responses.push({ url: message.params.response.url, status: message.params.response.status, mimeType: message.params.response.mimeType });
});
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = nextId++; waiting.set(id, { resolve: resolveCall, reject, method }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const viewport = (width, height = 900) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
const navigate = async hash => { await send('Page.navigate', { url: `http://127.0.0.1:4173/${hash || ''}` }); await pause(500); await send('Page.reload', { ignoreCache: true }); await pause(1100); };
const click = async selector => {
  const position = await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); if(!element) throw new Error('Missing '+${JSON.stringify(selector)}); element.scrollIntoView({block:'center',behavior:'instant'}); const rect=element.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position });
  await pause(450);
};
const key = async (keyName, code = keyName, modifiers = 0) => {
  const virtualCode = { Escape: 27, Tab: 9, Enter: 13 }[keyName] || 0;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, modifiers, windowsVirtualKeyCode: virtualCode, nativeVirtualKeyCode: virtualCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, modifiers, windowsVirtualKeyCode: virtualCode, nativeVirtualKeyCode: virtualCode });
  await pause(400);
};
const fill = async (selector, text) => {
  await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); element.focus(); element.value=''; element.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await send('Input.insertText', { text });
};
const screenshot = async (name, full = false) => {
  await evaluate('window.scrollTo(0,0)');
  await pause(400);
  const metrics = full ? await send('Page.getLayoutMetrics') : null;
  const size = metrics?.cssContentSize || metrics?.contentSize;
  const clip = full ? { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } : undefined;
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
  await writeFile(resolve(output, name), Buffer.from(result.data, 'base64'));
};
const results = [];
const check = (name, passed, details = null) => { results.push({ name, passed: Boolean(passed), details }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${details ? ': ' + JSON.stringify(details) : ''}`); };
await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
try {
  await viewport(1440);
  await navigate('#home');
  if (['mobile-check', 'visuals'].includes(process.argv[2])) {
    for (const width of process.argv[2] === 'visuals' ? [360, 390, 1440] : [360, 390]) {
      await viewport(width, width < 600 ? 844 : 900);
      for (const page of ['home', 'menu', 'atmosphere', 'booking']) {
        await navigate(`#${page}`);
        await evaluate(`Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>null)}))`);
        const measurement = await evaluate(`({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,images:[...document.images].every(img=>img.complete&&img.naturalWidth>0),fonts:document.fonts.check('16px Manrope')&&document.fonts.check('16px Cormorant')})`);
        check(`${width}px ${page}: layout и ресурсы`, measurement.content <= width && measurement.images && measurement.fonts, measurement);
        if (page === 'booking' && width < 600) check(`${width}px форма: шрифт полей 16px`, await evaluate(`[...document.querySelectorAll('#booking-form input,#booking-form select,#booking-form textarea')].every(field=>parseFloat(getComputedStyle(field).fontSize)>=16)`));
        await screenshot(`${page}-${width}.png`);
        if ([390, 1440].includes(width)) await screenshot(`${page}-${width}-full.png`, true);
        if (page === 'menu') {
          await click('#menu-grid [data-dish]');
          check(`${width}px диалог`, await evaluate(`document.querySelector('#detail-dialog').open && document.querySelector('#detail-dialog').getBoundingClientRect().right<=innerWidth && document.querySelector('#detail-dialog').getBoundingClientRect().left>=0`));
          await screenshot(width < 600 ? `dish-${width}.png` : 'dish-desktop.png');
          if (width === 390) await screenshot('dish-mobile.png');
          await key('Escape');
        }
        if (page === 'atmosphere' && width === 1440) {
          const count = await evaluate(`document.querySelectorAll('#atmosphere [data-gallery]').length`);
          for (let index = 0; index < count; index++) {
            const gallerySelector = `#atmosphere [data-gallery]:nth-of-type(${index + 1})`;
            await click(gallerySelector);
            check(`Галерея: фотография ${index + 1}`, await evaluate(`document.querySelector('#detail-dialog').open && document.querySelector('#dialog-body img').src.endsWith(document.querySelector(${JSON.stringify(gallerySelector)}).dataset.gallery)`));
            if (index === 0) await screenshot('gallery-desktop.png');
            await key('Escape');
          }
        }
      }
    }
    check('Ошибки JavaScript отсутствуют', errors.length === 0, errors);
    check('Ресурсы без HTTP-ошибок', responses.every(response=>response.status<400), responses.filter(response=>response.status>=400));
    await writeFile(resolve(output, `${process.argv[2]}-results.json`), JSON.stringify({date:new Date().toISOString(),results,errors},null,2));
    process.exitCode=results.some(result=>!result.passed)?1:0;
  } else if (process.argv[2] === 'measure') {
    await viewport(390, 844);
    await navigate('#booking');
    console.log(JSON.stringify(await evaluate(`({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('#booking *')].map(e=>({tag:e.tagName,id:e.id,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>390||e.left<0)})`), null, 2));
  } else if (process.argv[2] === 'preview') {
    await screenshot('preview-desktop.png');
    await viewport(390, 844);
    await navigate('#home');
    await screenshot('preview-mobile.png');
    console.log('Saved preview-desktop.png and preview-mobile.png');
  } else if (process.argv[2] === 'snapshot') {
    console.log(JSON.stringify(await evaluate(`({title:document.title, hash:location.hash, pages:[...document.querySelectorAll('[data-page]')].map(p=>({id:p.id,hidden:p.hidden})), cards:document.querySelectorAll('.dish-card').length, text:document.body.innerText.slice(0,5000)})`), null, 2));
  } else {
    check('Главная и 4 избранных блюда', await evaluate(`!document.querySelector('#home').hidden && document.querySelectorAll('#favorites-grid .dish-card').length === 4`));
    await click('#main-nav a[href="#menu"]');
    check('Переход в меню и 12 блюд', await evaluate(`location.hash==='#menu' && !document.querySelector('#menu').hidden && document.querySelectorAll('#menu-grid .dish-card').length===12`));
    const categoryCounts = { starter: 4, hot: 3, oven: 2, dessert: 2, drink: 1, all: 12 };
    for (const [category, expected] of Object.entries(categoryCounts)) {
      await click(`[data-category="${category}"]`);
      const current = await evaluate(`({count:document.querySelectorAll('#menu-grid .dish-card').length,pressed:document.querySelector('[data-category="${category}"]').getAttribute('aria-pressed')})`);
      check(`Категория ${category}`, current.count === expected && current.pressed === 'true', current);
    }
    const ids = await evaluate(`[...document.querySelectorAll('#menu-grid [data-dish]')].map(e=>e.dataset.dish)`);
    for (const id of ids) {
      await click(`#menu-grid [data-dish="${id}"]`);
      const info = await evaluate(`({open:document.querySelector('#detail-dialog').open,title:document.querySelector('#dialog-title')?.textContent,focusInside:document.querySelector('#detail-dialog').contains(document.activeElement),locked:document.body.classList.contains('modal-open')})`);
      const expectedTitle = await evaluate(`document.querySelector('#menu-grid [data-dish="${id}"] h3').textContent`);
      check(`Диалог ${id}`, info.open && info.title === expectedTitle && info.focusInside && info.locked, info);
      if (id === ids[0]) {
        await screenshot('dish-desktop.png');
        for (let i = 0; i < 6; i++) await key('Tab');
        check('Фокус остаётся внутри диалога', await evaluate(`document.querySelector('#detail-dialog').contains(document.activeElement)`));
      }
      await key('Escape');
      check(`Escape и возврат фокуса ${id}`, await evaluate(`!document.querySelector('#detail-dialog').open && document.activeElement.dataset.dish==='${id}' && !document.body.classList.contains('modal-open')`));
    }
    await evaluate(`(() => {const a=document.querySelector('#menu-grid [data-dish="khinkali"]');const b=document.querySelector('#menu-grid [data-dish="adjaruli"]');const close=document.querySelector('[data-close-dialog]');a.click();close.click();b.click();close.click();a.click()})()`);
    await pause(600);
    check('Быстрое открытие/закрытие: последнее блюдо активно', await evaluate(`document.querySelector('#detail-dialog').open && document.querySelector('#dialog-title').textContent==='Хинкали' && document.body.classList.contains('modal-open')`));
    await key('Escape');
    await evaluate(`for (const c of ['oven','starter','drink','hot','all']) document.querySelector('[data-category="'+c+'"]').click()`);
    await pause(650);
    check('Быстрая смена категорий: последнее действие сохранено', await evaluate(`document.querySelectorAll('#menu-grid .dish-card').length===12 && document.querySelector('[data-category="all"]').getAttribute('aria-pressed')==='true'`));
    await evaluate(`location.hash='#atmosphere'`);
    await pause(650);
    check('Атмосфера', await evaluate(`!document.querySelector('#atmosphere').hidden`));
    await click('[data-gallery]');
    check('Увеличение галереи', await evaluate(`document.querySelector('#detail-dialog').open && !!document.querySelector('#dialog-body img')`));
    await screenshot('gallery-desktop.png');
    await click('[data-close-dialog]');
    check('Явное закрытие галереи', await evaluate(`!document.querySelector('#detail-dialog').open`));
    await evaluate(`location.hash='#booking'`);
    await pause(650);
    await click('#booking-form button[type="submit"]');
    check('Пустая форма: inline-ошибки и фокус', await evaluate(`document.querySelectorAll('#booking-form [aria-invalid="true"]').length>=4 && document.activeElement.id==='booking-name'`));
    await fill('#booking-name', ' ');
    await fill('#booking-phone', 'abc123');
    await evaluate(`(() => {const d=document.querySelector('#booking-date');d.value='2020-01-01';d.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('#booking-form button[type="submit"]');
    check('Неверные имя, телефон и прошедшая дата отклонены', await evaluate(`['name','phone','date'].every(name=>document.querySelector('#booking-'+name).getAttribute('aria-invalid')==='true')`));
    await fill('#booking-name', 'Тестовый гость');
    await fill('#booking-phone', '+7 999 123-45-67');
    await evaluate(`(() => { const d=document.querySelector('#booking-date');d.value=d.min;d.dispatchEvent(new Event('input',{bubbles:true}));const t=document.querySelector('#booking-time');t.value='18:00';t.dispatchEvent(new Event('change',{bubbles:true}));const g=document.querySelector('#booking-guests');g.value='3';g.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await fill('#booking-comment', 'Проверка демонстрационной формы');
    const beforeRequests = responses.length;
    await click('#booking-form button[type="submit"]');
    check('Честный результат демо без отправки', await evaluate(`document.querySelector('#booking-feedback').textContent.includes('Демонстрационная заявка. В ресторан не отправлена')`));
    check('Отправка не создаёт сетевой запрос', responses.length === beforeRequests, responses.slice(beforeRequests));
    await screenshot('booking-demo-desktop.png', true);
    await evaluate(`(() => {const d=document.querySelector('#booking-date');d.value='2099-01-01';d.dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('#booking-comment');c.value='x'.repeat(501);c.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('#booking-form button[type="submit"]');
    check('Дата дальше 90 дней и длинный комментарий отклонены', await evaluate(`['date','comment'].every(name=>document.querySelector('#booking-'+name).getAttribute('aria-invalid')==='true') && !document.querySelector('#booking-feedback').textContent.trim()`));
    await fill('#booking-name', 'Другое имя');
    check('Изменение формы убирает устаревшее сообщение', await evaluate(`!document.querySelector('#booking-feedback').textContent.trim() || document.querySelector('#booking-feedback').hidden`));
    await evaluate(`location.hash='#menu'`); await pause(550);
    await evaluate('history.back()'); await pause(550);
    check('Назад', await evaluate(`location.hash==='#booking' && !document.querySelector('#booking').hidden`));
    await evaluate('history.forward()'); await pause(550);
    check('Вперёд', await evaluate(`location.hash==='#menu' && !document.querySelector('#menu').hidden`));
    await navigate('#home');
    for (const width of [360, 390, 768, 1024, 1440]) {
      await viewport(width, width < 600 ? 844 : 900);
      for (const page of ['home', 'menu', 'atmosphere', 'booking']) {
        await evaluate(`location.hash='#${page}'`); await pause(600);
        const sizing = await evaluate(`({viewport:innerWidth,content:document.documentElement.scrollWidth,images:[...document.querySelectorAll('[data-page="${page}"] img')].filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.getAttribute('src'))})`);
        check(`${width}px ${page}: без горизонтального скролла`, sizing.content <= width, sizing);
        await screenshot(`${page}-${width}.png`);
        if ([390, 1440].includes(width)) await screenshot(`${page}-${width}-full.png`, true);
      }
    }
    await viewport(390, 844);
    await evaluate(`location.hash='#home'`); await pause(600);
    await click('#nav-toggle');
    check('Мобильная навигация открыта', await evaluate(`document.querySelector('#nav-toggle').getAttribute('aria-expanded')==='true'`));
    await click('#main-nav a[href="#menu"]');
    check('Мобильная навигация закрыта после перехода', await evaluate(`location.hash==='#menu' && document.querySelector('#nav-toggle').getAttribute('aria-expanded')==='false'`));
    await click('#nav-toggle'); await key('Escape');
    check('Escape закрывает мобильную навигацию', await evaluate(`document.querySelector('#nav-toggle').getAttribute('aria-expanded')==='false' && document.activeElement.id==='nav-toggle'`));
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate(`location.hash='#home'`); await pause(200);
    check('Режим уменьшенного движения', await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches && !document.querySelector('#home').hidden`));
    await evaluate(`location.hash='#menu'`); await pause(100);
    await click('#menu-grid [data-dish]');
    check('Диалог при уменьшенном движении', await evaluate(`document.querySelector('#detail-dialog').open`));
    await screenshot('dish-mobile.png');
    await key('Escape');
    await send('Emulation.setEmulatedMedia', { features: [] });
    await viewport(1440);
    await navigate('#home');
    await evaluate(`Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>null)}))`);
    check('Изображения загружены', await evaluate(`[...document.images].every(img=>img.complete&&img.naturalWidth>0)`));
    check('Ошибки JavaScript отсутствуют', errors.length === 0, errors);
    const broken = responses.filter(response => response.status >= 400);
    check('Ресурсы без HTTP-ошибок', broken.length === 0, broken);
    await writeFile(resolve(output, 'browser-results.json'), JSON.stringify({ date: new Date().toISOString(), tool: 'Microsoft Edge via Chrome DevTools Protocol; Node.js built-in WebSocket', results, errors, resources: responses }, null, 2));
    console.log(`RESULT ${results.filter(result=>result.passed).length}/${results.length}`);
    process.exitCode = results.some(result => !result.passed) ? 1 : 0;
  }
} finally { ws.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`); }
