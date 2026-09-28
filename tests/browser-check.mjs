// Run against a disposable Chrome profile with remote debugging on port 9236.
// No game or service endpoints are called. All answers belong to a throwaway QA run.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin=process.env.QA_URL||'http://127.0.0.1:4186';
const debug=process.env.CHROME_DEBUG_URL||'http://127.0.0.1:9236';
const output=resolve('/tmp/faster-horse-qa-validation');
await mkdir(output,{recursive:true});
for(const file of await readdir(output)) if(file.startsWith('Faster-Horse-QA-')&&file.endsWith('.html')) await rm(resolve(output,file));
const target=await fetch(debug+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
let seq=0;const pending=new Map(),errors=[],requests=[];
ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.method==='Network.requestWillBeSent')requests.push(msg.params);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);if(pending.has(msg.id)){const {ok,fail}=pending.get(msg.id);pending.delete(msg.id);msg.error?fail(new Error(JSON.stringify(msg.error))):ok(msg.result);}};
const send=(method,params={})=>new Promise((ok,fail)=>{const id=++seq;pending.set(id,{ok,fail});ws.send(JSON.stringify({id,method,params}));});
const run=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function loaded(){for(let i=0;i<50;i++){if(await run('!!document.getElementById("qa-data") && typeof DATA !== "undefined"'))return;await wait(100);}throw new Error('QA page did not load');}
async function navigate(url){await send('Page.navigate',{url});await wait(250);await loaded();}
async function start(mode='solo'){await run(`localStorage.clear();location.reload()`);await wait(300);await loaded();await run(`$('tester').value='QA Browser Check';$('device').value='Disposable Chrome';$('platform').value='Chrome test';$('mode').value=${JSON.stringify(mode)};$('setup').requestSubmit()`);}
async function chooseResult(value){await run(`document.querySelector('[name=outcome][value="${value}"]').click()`);}
async function upload(selector,path){const root=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await wait(200);}
async function downloaded(before=[]){for(let i=0;i<50;i++){const name=(await readdir(output)).find(f=>f.startsWith('Faster-Horse-QA-')&&f.endsWith('.html')&&!before.includes(f));if(name)return name;await wait(100);}throw new Error('Report did not download');}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output});
 await navigate(origin);
 assert.equal(await run('DATA.tests.length'),11);
 await run("localStorage.clear();location.reload()");await wait(300);await loaded();
 assert.equal(await run("document.querySelectorAll('[required]').length"),0);
 assert.equal(await run("document.querySelectorAll('input[type=url]').length"),0);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
 const welcome=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(output,'short-welcome.png'),Buffer.from(welcome.data,'base64'));
 // Starting and reporting with no personal details or answers is permitted.
 await run("$('download-dock').click()");const empty=await downloaded();assert.equal(await run('tests().length'),8);
 assert.equal(await run("$('extensive-nav').hidden"),true,'Short checklist has no section/subsection controls');
 assert.equal(await run("$('test-select')"),null);
 assert.equal(await run("$('mode-label').textContent"),'Solo game');
 await run("choose('NAME-001');$('next').click()");assert.equal(await run('current().id'),'SMOKE-006');
 await run("$('previous').click()");assert.equal(await run('current().id'),'NAME-001');await run("choose('SMOKE-001')");
 assert.equal(await run('state.profile.tester'),'');assert.equal(await run('exportReady()'),true);
 const emptyHTML=await readFile(resolve(output,empty),'utf8');assert.match(emptyHTML,/PARTIAL REPORT/);assert.match(emptyHTML,/NOT TESTED/);assert.match(emptyHTML,/<strong>Mode:<\/strong> Solo game/);assert.doesNotMatch(emptyHTML,/<strong>Before:/);
 await run("$('summary').close()");assert.equal(await run("$('next').disabled"),false);
 await run("$('next').click()");assert.equal(await run('current().id'),'GAME-014');
 assert.equal(await run("answer('SMOKE-001').status"),'NOT TESTED');
 await chooseResult('FAIL');assert.equal(await run("$('notes').required"),false);assert.equal(await run("$('next').disabled"),false);
 await run("$('next').click()");assert.equal(await run('current().id'),'NAME-001');
 await chooseResult('BLOCKED');await run("$('next').click()");assert.equal(await run('current().id'),'SMOKE-006');
 await chooseResult('N/A');assert.equal(await run("answer('SMOKE-006').status"),'N/A');
 await run("choose('SHARE-001')");assert.equal(await run('current().id'),'SHARE-001');
 console.log('PASS: 8 short checks; blank details, skipped/failed/blocked answers, no required notes/screenshots, unrestricted navigation and zero-answer reports.');

 assert.equal(await run('activeSuite()'),'short');assert.equal(await run("$('suite').value"),'short');
 await run("choose('BUG-001')");assert.equal(await run("document.querySelector('[name=outcome][value=FAIL]').closest('label').querySelector('strong').textContent"),'Found a bug');
 await chooseResult('FAIL');assert.equal(await run('exportReady()'),true);assert.equal(await run("$('notes').required"),false);
 await run("choose('SHARE-001')");
 // Attaching an image never locks navigation; it belongs to the originating check.
 const png=resolve(output,'evidence.png');await writeFile(png,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXX8AAAAASUVORK5CYII=','base64'));
 await run("$('evidence-details').open=true");await upload('#photos',png);
 for(let i=0;i<30&&!(await run("answer('SHARE-001').photos.length"));i++)await wait(100);
 assert.equal(await run("answer('SHARE-001').photos.length"),1);
 await run("pendingPhotos++;renderNav()");assert.equal(await run("$('next').disabled"),false);assert.equal(await run('exportReady()'),true);await run('pendingPhotos--');
 await run("$('notes').value='Optional detail <script>window.injected=true</script>';$('notes').dispatchEvent(new Event('input'));showSummary();$('download').click()");
 const report=await downloaded([empty]);const html=await readFile(resolve(output,report),'utf8');assert.match(html,/data:image\/png;base64,/);assert.match(html,/PARTIAL REPORT/);assert.match(html,/Optional detail &lt;script&gt;/);
 await run("$('summary').close();location.reload()");await wait(300);await loaded();assert.equal(await run("answer('SHARE-001').photos.length"),1);
 // Actual downloaded report restores anonymous profiles and optional empty notes.
 await start('website');await upload('#import-report',resolve(output,report));assert.equal(await run("$('import-confirm').open"),true);await run("$('confirm-import').click()");
 assert.equal(await run('state.profile.mode'),'solo');assert.equal(await run('state.profile.tester'),'');assert.equal(await run("answer('SHARE-001').photos.length"),1);assert.equal(await run("answer('GAME-014').status"),'FAIL');
 await run("choose('GAME-014')");await chooseResult('PASS');await run("showSummary();$('download').click()");const revised=await downloaded([empty,report]);const revisedHTML=await readFile(resolve(output,revised),'utf8');
 const payload=JSON.parse(revisedHTML.match(/<script id="qa-report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(payload.tests.find(t=>t.id==='GAME-014').status,'PASS');assert.equal(payload.tests.find(t=>t.id==='SHARE-001').photos.length,1);
 await run("$('summary').close()");
 console.log('PASS: optional embedded screenshot, persistence, anonymous import, retest and revised export.');
 // Earlier HTML format, and an older extended list: only matching current checks are restored.
 const legacy=resolve(output,'legacy-report.html');await writeFile(legacy,html.replace(/<script id="qa-report-data" type="application\/json">[\s\S]*?<\/script>/,''));
 await upload('#import-report',legacy);assert.equal(await run("$('import-confirm').open"),true);await run("$('confirm-import').click()");assert.equal(await run("answer('SHARE-001').photos.length"),1);
 const longer=structuredClone(payload);longer.tests.push({...longer.tests[0],id:'UI-008'});longer.tests[0].expected='Old instructions';
 const longFile=resolve(output,'old-long-report.html');await writeFile(longFile,'<script id="qa-report-data" type="application/json">'+JSON.stringify(longer).replaceAll('<','\\u003c')+'</script>');
 await upload('#import-report',longFile);assert.match(await run("$('import-preview').textContent"),/1 checks are not in this checklist/);await run("$('confirm-import').click()");assert.equal(await run("answer('SMOKE-001').status"),'NOT TESTED');assert.equal(await run('tests().length'),8);
 const snapshot=await run('JSON.stringify(state)');const bad=resolve(output,'invalid-report.html');await writeFile(bad,'<script>window.injected=true</script><img src="https://example.com/never-request">');
 await upload('#import-report',bad);assert.match(await run("$('import-status').textContent"),/Could not open/);assert.equal(await run('JSON.stringify(state)'),snapshot);assert.equal(await run('typeof window.injected'),'undefined');
 const wrong=resolve(output,'wrong-date.html');await writeFile(wrong,html.replaceAll('2026-09-28','2026-09-27'));await upload('#import-report',wrong);assert.match(await run("$('import-status').textContent"),/for build 2026-09-27/);assert.equal(await run('JSON.stringify(state)'),snapshot);
 console.log('PASS: older report compatibility, disclosed retired checks, changed-answer reset, invalid-file rejection and safe inert import.');
 for(const width of [1440,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await wait(100);assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'),true);await run('window.scrollTo(0,document.body.scrollHeight)');assert.equal(await run("(()=>{const r=$('download-dock').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()"),true,'Download stays visible at the bottom of a scrolled page');await run('showSummary()');assert.equal(await run("$('summary').getBoundingClientRect().right<=innerWidth"),true);await run("$('summary').close()");const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(output,`short-${width}.png`),Buffer.from(shot.data,'base64'));}

 const shortSaved=await run('JSON.stringify(state.answers)');
 await run("$('switch-suite').click()");assert.equal(await run('activeSuite()'),'extensive');assert.equal(await run('tests().length'),88);
 assert.equal(await run("answer('GAME-014').status"),'NOT TESTED','Short and extensive results are isolated');
 assert.equal(await run('exportReady()'),true);assert.equal(await run("$('next').disabled"),false);
 assert.equal(await run("$('extensive-nav').hidden"),false);assert.equal(await run("document.querySelectorAll('#extensive-nav select').length"),2);
 await run("$('section').value='Results and leaderboards';$('section').dispatchEvent(new Event('change'));$('category').value='Connection loss and recovery';$('category').dispatchEvent(new Event('change'))");assert.ok((await run('current().id')).startsWith('NET-'));
 assert.equal(await run("$('check-context').hidden"),false);
 await chooseResult('FAIL');assert.equal(await run("$('notes').required"),false);assert.equal(await run("$('next').disabled"),false);
 const extensiveId=await run('current().id');await run("$('notes').value='Extensive offline check';$('notes').dispatchEvent(new Event('input'));showSummary()");
 const beforeExt=await readdir(output);await run("$('download').click()");const extFile=await downloaded(beforeExt);const extHTML=await readFile(resolve(output,extFile),'utf8');
 const extPayload=JSON.parse(extHTML.match(/<script id="qa-report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(extPayload.suite,'extensive');assert.equal(extPayload.tests.length,88);assert.match(extHTML,/Checklist: Extensive checklist/);
 await run("$('summary').close();$('switch-suite').click()");assert.equal(await run('JSON.stringify(state.answers)'),shortSaved);
 await run("$('switch-suite').click();location.reload()");await wait(300);await loaded();assert.equal(await run('activeSuite()'),'extensive');assert.equal(await run(`answer(${JSON.stringify(extensiveId)}).status`),'FAIL');
 await run("$('switch-suite').click()");assert.equal(await run('JSON.stringify(state.answers)'),shortSaved);
 await upload('#import-report',resolve(output,extFile));assert.equal(await run("$('import-confirm').open"),true);await run("$('confirm-import').click()");assert.equal(await run('activeSuite()'),'extensive');assert.equal(await run(`answer(${JSON.stringify(extensiveId)}).notes`),'Extensive offline check');
 const oldExt=resolve(output,'legacy-extensive.html');await writeFile(oldExt,extHTML.replace(/<script id="qa-report-data" type="application\/json">[\s\S]*?<\/script>/,'').replace('Checklist: Extensive checklist\n',''));
 await upload('#import-report',oldExt);assert.equal(await run("$('import-confirm').open"),true);await run("$('confirm-import').click()");assert.equal(await run('activeSuite()'),'extensive');
 console.log('PASS: default short suite, optional bug question, extensive access without gates, isolated/persistent answers, extensive export/import and legacy suite inference.');
 await start('multiplayer');assert.equal(await run("$('mode-label').textContent"),'Local multiplayer game');assert.equal(await run('tests().length'),8);assert.equal(await run("tests().some(t=>t.id==='MP-002')"),true);assert.equal(await run("tests().some(t=>t.id==='SHARE-001')"),false);await run("$('switch-suite').click()");assert.equal(await run('tests().length'),83);await run("$('switch-suite').click()");assert.equal(await run('tests().length'),8);
 await start('website');assert.equal(await run("$('mode-label').textContent"),'Leaderboard website');assert.equal(await run('tests().length'),2);assert.equal(await run('exportReady()'),true);
 for(let i=0;i<2;i++){await chooseResult('PASS');await run("$('next').click()");}assert.match(await run("$('summary-text').textContent"),/short checklist passed/);

 assert.equal(await run("$('completion').hidden"),false,'Completion panel appears when all checks have answers');
 assert.match(await run("$('dock-status').textContent"),/Checklist finished/);
 await run("$('summary').close();$('completion').scrollIntoView({block:'center'})");
 const completedShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(output,'completion-mobile.png'),Buffer.from(completedShot.data,'base64'));
 const beforeCompletionDownload=await readdir(output);await run("$('download-complete').click()");await downloaded(beforeCompletionDownload);
 await run("choose('WEB-002')");await chooseResult('FAIL');assert.equal(await run("$('completion').hidden"),false);assert.doesNotMatch(await run('reportHTML()'),/ALL CHECKS IN THIS SHORT CHECKLIST PASSED/);
 console.log('PASS: extensive-only sections/subsections, persistent download at all viewport sizes, direct download before setup, and prominent completion export without false pass claims.');
 await run("$('summary').close();choose('WEB-001')");await chooseResult('N/A');await run("choose('WEB-002')");await chooseResult('N/A');await run('showSummary()');assert.match(await run("$('summary-text').textContent"),/Doesn’t apply/);assert.doesNotMatch(await run("$('summary-text').textContent"),/passed/);
 // Completed progress persists, and restart clears both suites only after confirmation.
 await run("$('summary').close();location.reload()");await wait(300);await loaded();
 assert.equal(await run("$('completion').hidden"),false);
 const completedState=await run('JSON.stringify(state)');
 await run("$('restart-complete').click()");assert.equal(await run("$('restart-dialog').open"),true);
 await run("$('cancel-restart').click()");assert.equal(await run('JSON.stringify(state)'),completedState);
 await run("$('switch-suite').click()");await chooseResult('FAIL');
 await run("$('notes').value='Clear this too';$('notes').dispatchEvent(new Event('input'))");
 await upload('#photos',png);assert.equal(await run('answer(current().id).photos.length'),1);
 await run("pendingPhotos++;renderNav()");assert.equal(await run("$('restart-questionnaire').disabled"),true);
 await run("pendingPhotos--;renderNav();$('restart-questionnaire').click()");
 const beforeRestartDownload=await readdir(output);await run("$('download-before-restart').click()");await downloaded(beforeRestartDownload);
 assert.equal(await run("$('restart-dialog').open"),true,'Downloading does not restart');
 await run("$('confirm-restart').click()");
 assert.equal(await run("$('welcome').hidden"),false);assert.equal(await run("$('testing').hidden"),true);
 assert.equal(await run('state.profile'),null);assert.deepEqual(await run('state.answers'),{});assert.deepEqual(await run('state.otherSuites'),{});
 await run('location.reload()');await wait(300);await loaded();
 assert.equal(await run("$('welcome').hidden"),false);assert.equal(await run("$('tester').value"),'');assert.equal(await run("$('suite').value"),'short');
 await run("$('setup').requestSubmit();$('switch-suite').click()");
 assert.equal(await run('tests().every(t=>answer(t.id).status===\'NOT TESTED\' && !answer(t.id).notes && !answer(t.id).photos.length)'),true);
 console.log('PASS: completed-session persistence, restart cancellation, download before restart, both suites cleared and fresh session after reload.');
 await run("Storage.prototype.setItem=function(){throw Error('unavailable')};remember()");assert.match(await run("$('save-status').textContent"),/could not be saved/);
 assert.deepEqual(requests.filter(r=>/^https?:/.test(r.request.url)&&r.type!=='Document'),[]);
 assert.ok(requests.filter(r=>/^https?:/.test(r.request.url)).every(r=>new URL(r.request.url).origin===new URL(origin).origin));
 assert.equal(await run("fetch('/__blocked').then(()=>false,()=>true)"),true);
 await navigate('file://'+resolve(new URL('../index.html',import.meta.url).pathname));assert.equal(await run('DATA.tests.length'),11);
 assert.deepEqual(errors,[]);console.log('PASS: mobile/desktop layouts, mode filtering, storage warning, no API requests, blocked script connections and standalone file.');
 console.log('All short volunteer-checklist checks passed. Evidence: '+output);
}finally{await send('Page.close');ws.close();}
