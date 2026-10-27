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
  const state = async name => evaluate(`(() => {const p=document.querySelector('#'+${JSON.stringify(name)});const s=getComputedStyle(p);return !p.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&[...document.querySelectorAll('[data-page]')].filter(p=>!p.hidden).length===1&&document.querySelector('#main-nav [aria-current="page"]')?.hash==='#'+${JSON.stringify(name)}})()`);
  await viewport(1440);
  await navigate('#home');
  await evaluate("Element.prototype.animate=undefined");
  await click('#main-nav a[href="#menu"]');
  check('Missing animate: navigation remains visible', await state('menu'));
  const injectedErrors = errors.splice(0);
  console.log('INJECTED_ERRORS', JSON.stringify(injectedErrors));
  if (process.argv[2] !== 'before') {
    for (const width of [1440,390]) {
      await viewport(width, width===390?844:900);
      await navigate('#home');
      for (const name of ['menu','atmosphere','booking','home']) {
        if(width===390) await click('#nav-toggle');
        await click(width===1440 && name==='booking' ? '.header-booking' : '#main-nav a[href="#'+name+'"]');
        check(width+' pointer navigation '+name,await state(name));
        check(width+' mobile menu closed '+name,await evaluate("!document.body.classList.contains('nav-open')"));
      }
      for(const name of ['home','menu','atmosphere','booking']) {
        await navigate('#'+name);
        check(width+' direct URL and reload '+name,await state(name));
        await screenshot('navigation-'+name+'-'+width+'.png');
      }
      await navigate('#home');
      for(const target of ['menu','booking']) {
        await click('.hero-actions a[href="#'+target+'"]');
        check(width+' hero CTA '+target,await state(target));
        await evaluate('history.back()');await pause(500);
        check(width+' Back home',await state('home'));
        await evaluate('history.forward()');await pause(500);
        check(width+' Forward '+target,await state(target));
        await navigate('#home');
      }
      await click('.story-copy a[href="#atmosphere"]');
      check(width+' atmosphere CTA',await state('atmosphere'));
    }
    for(const mode of ['missing','throws','pending','rejects','no-observer','reduce']) {
      const scripts={missing:'Element.prototype.animate=undefined',throws:'Element.prototype.animate=function(){throw new Error("Injected effect failure")}',pending:'Element.prototype.animate=function(){return {finished:new Promise(()=>{}),cancel(){}}}',rejects:'Element.prototype.animate=function(){return {finished:Promise.reject(new Error("Injected cancellation")),cancel(){}}}', 'no-observer':'delete window.IntersectionObserver',reduce:''};
      const init=await send('Page.addScriptToEvaluateOnNewDocument',{source:scripts[mode]});
      await send('Emulation.setEmulatedMedia',{features:mode==='reduce'?[{name:'prefers-reduced-motion',value:'reduce'}]:[]});
      await navigate('#home');
      for(const name of ['menu','atmosphere','booking','home']) {
        await evaluate('document.querySelector(\'#main-nav a[href="#'+name+'"]\').click()');await pause(80);
        check(mode+' immediate route '+name,await state(name));
      }
      await evaluate('document.querySelector(\'#main-nav a[href="#menu"]\').click()');await pause(30);
      await click('#menu-grid [data-dish]');
      await click('[data-close-dialog]');await pause(800);
      check(mode+' dialog closes',await evaluate("!document.querySelector('#detail-dialog').open"));
      await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:init.identifier});
    }
    await send('Emulation.setEmulatedMedia',{features:[]});
    await navigate('#home');
    for(const name of ['menu','atmosphere','booking','menu','home','booking']) {
      await evaluate('document.querySelector(\'#main-nav a[href="#'+name+'"]\').click()');await pause(20);
    }
    await pause(600);check('Rapid switching: final booking',await state('booking'));
    check('No JavaScript errors',errors.length===0,errors);
    check('HTTP resources load',responses.every(r=>r.status<400),responses.filter(r=>r.status>=400));
  }
  await send('Page.navigate',{url:new URL('../index.html',import.meta.url).href});await pause(900);
  await evaluate("document.querySelector('#main-nav a[href=\"#menu\"]').click()");await pause(500);
  check('file protocol reproduces unavailable modules',await evaluate("location.protocol==='file:'&&document.querySelector('#menu').hidden&&document.querySelectorAll('.dish-card').length===0"));
  await writeFile(resolve(output,'navigation-'+(process.argv[2]||'after')+'.json'),JSON.stringify({date:new Date().toISOString(),results,errors,responses},null,2));
  process.exitCode=results.some(r=>!r.passed)?1:0;
}finally{ws.close();await fetch('http://127.0.0.1:9222/json/close/'+tab.id);}
