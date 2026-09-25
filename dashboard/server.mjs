import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4317);
const host = '127.0.0.1';
const origin = `http://${host}:${port}`;
const progressPath = path.join(root, 'dashboard/progress.json');
const runtimePath = path.join(root, 'data/dashboard-checks.json');
const telemetryPath = path.join(root, 'data/telemetry-summary.json');
let busy = false;
async function readJSON(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } }
async function config() {
  const text = await readFile(path.join(root, '.env'), 'utf8').catch(() => '');
  return Object.fromEntries(text.split(/\r?\n/).filter(s => s.trim() && !s.trim().startsWith('#') && s.includes('=')).map(s => { const i = s.indexOf('='); return [s.slice(0,i).trim(), s.slice(i+1).trim().replace(/^(["'])(.*)\1$/, '$2')]; }));
}
async function jsonRequest(url, body, key, timeout = 15000) {
  const response = await fetch(url, {method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json', ...(key ? {Authorization:`Bearer ${key}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(timeout)});
  if (!response.ok) throw new Error(`Service returned HTTP ${response.status}`);
  return response.json();
}
async function status() {
  const [cfg, progress, checks, evaluation, telemetry] = await Promise.all([config(), readJSON(progressPath, {}), readJSON(runtimePath, {}), readJSON(path.join(root,'data/model-evaluation.json'), null), readJSON(telemetryPath, null)]);
  let ollama = {online:false, installed:[], modelAvailable:false};
  try { const tags = await jsonRequest('http://127.0.0.1:11434/api/tags', null, null, 2000); const installed = tags.models.map(m=>m.name); ollama = {online:true, installed, modelAvailable:installed.some(n=>n===cfg.LIQUID_MODEL || n===cfg.LIQUID_MODEL+':latest')}; } catch {}
  return {...progress,checks:{...progress.checks,...checks},evaluation,telemetry,ollama, busy, serverTime:new Date().toISOString(), config:{nimble:!!cfg.NIMBLE_API_KEY, rawtree:!!cfg.RAWTREE_API_KEY, database:cfg.RAWTREE_DATABASE || 'default', model:cfg.LIQUID_MODEL || 'Not configured'}, source:'Local project status + measured lifecycle telemetry + live Ollama check'};
}
async function checkConnections() {
  if (busy) return;
  busy = true;
  try {
    const cfg = await config(); const results = await readJSON(runtimePath, {});
    const jobs = [
      ['nimble', async()=> { if(!cfg.NIMBLE_API_KEY) throw new Error('Add the Nimble key to your local .env file.'); const r=await jsonRequest('https://sdk.nimbleway.com/v2/search',{query:'Liquid AI official model documentation',max_results:2,search_depth:'lite'},cfg.NIMBLE_API_KEY,45000); if(!r.results?.some(x=>x.url)) throw new Error('Search returned no source URLs.'); return `Live search returned ${r.results.length} results.`; }],
      ['rawtree', async()=> { if(!cfg.RAWTREE_API_KEY) throw new Error('Add the RawTree key to your local .env file.'); const suffix='?database='+encodeURIComponent(cfg.RAWTREE_DATABASE || 'default'); const id=crypto.randomUUID(); const r=await jsonRequest('https://api.rawtree.com/v1/tables/spore_karthik_memory_events'+suffix,[{event_id:id,project:'spore',event_type:'connection_test',is_test:true,timestamp:new Date().toISOString()}],cfg.RAWTREE_API_KEY); if(r.inserted!==1) throw new Error('Test event was not acknowledged.'); const q=await jsonRequest('https://api.rawtree.com/v1/query'+suffix,{sql:`SELECT event_id FROM spore_karthik_memory_events WHERE event_id = '${id}' LIMIT 1`},cfg.RAWTREE_API_KEY); if(!JSON.stringify(q).includes(id)) throw new Error('Event inserted; read-back not yet verified.'); return 'Test event written and read back successfully.'; }]
    ];
    await Promise.all(jobs.map(async([name,fn])=> { try { results[name]={status:'verified',detail:await fn(),checkedAt:new Date().toISOString()}; } catch(e) { results[name]={status:'error',detail:e.message,checkedAt:new Date().toISOString()}; } }));
    await mkdir(path.dirname(runtimePath),{recursive:true}); await writeFile(runtimePath,JSON.stringify(results,null,2));
  } finally { busy=false; }
}
const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
http.createServer(async(req,res)=> {
  const hostHeader = req.headers.host;
  if(![`${host}:${port}`,`localhost:${port}`].includes(hostHeader)) { res.writeHead(403); res.end('Local access only'); return; }
  const send=(code,data,type='application/json')=> {res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
  try {
    const url = new URL(req.url,origin);
    if(req.method==='GET' && url.pathname==='/api/status') return send(200,await status());
    if(req.method==='POST' && url.pathname==='/api/check') {
      if(![origin,`http://localhost:${port}`].includes(req.headers.origin)) return send(403,{error:'Same-origin request required.'});
      if(busy) return send(409,{error:'Checks already running.'});
      checkConnections().catch(()=>{}); return send(202,{started:true});
    }
    if(req.method==='GET' && files[url.pathname]) { const file=files[url.pathname];return send(200,await readFile(path.join(root,'dashboard/public',file)),file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'); }
    send(404,{error:'Not found'});
  } catch {send(500,{error:'Could not read project status. Please check the local server.'});}
}).listen(port,host,()=>console.log(`SPORE dashboard: ${origin}`));
