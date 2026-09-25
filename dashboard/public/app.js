const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastState=null, lastMarkup='';
const time=s=>s?new Date(s).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not yet checked';
const safeUrl=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch{return '#';}};
const pretty=value=>escape(JSON.stringify(value,null,2));
const demoSteps=[
 {stage:0,action:'observe',number:'01',title:'Create the observation',tool:'SQLite',tone:'local',description:'Write the original provider research into persistent working memory.',command:'npm run demo -- observe'},
 {stage:1,action:'classify',number:'02',title:'Classify the memory',tool:'SPORE gate',tone:'local',description:'Apply the validated four-state policy and create a typed wake condition.',command:'npm run demo -- classify'},
 {stage:2,action:'sleep',number:'03',title:'Archive and forget',tool:'SQLite + archive',tone:'local',description:'Save detailed evidence, create a compact dormant spore, and release working context.',command:'npm run demo -- sleep'},
 {stage:3,action:'wake-live',number:'04',title:'Check the live web',tool:'Nimble',tone:'nimble',description:'Run the due-spore watcher against current web evidence and evaluate the condition.',command:'npm run demo -- wake-live'},
 {stage:4,action:'rehydrate',number:'05',title:'Restore the evidence',tool:'Archive',tone:'local',description:'Verify the checksum and combine historical rationale with fresh facts.',command:'npm run demo -- rehydrate'},
 {stage:5,action:'act',number:'06',title:'Reevaluate and act',tool:'Liquid AI',tone:'liquid',description:'Run local inference behind a deterministic guard, then update the shortlist exactly once.',command:'npm run demo -- act'},
 {stage:6,action:'telemetry',number:'07',title:'Publish the proof',tool:'RawTree',tone:'rawtree',description:'Send the complete event timeline and verify every event by reading it back.',command:'npm run demo -- telemetry'},
];
function proofSection(title,content,extra=''){return `<section class="proof-section"><div class="proof-title"><strong>${escape(title)}</strong>${extra}</div>${content}</section>`;}
function renderAutonomous(agent){
 if(!agent)return;
 const job=agent.job||{};
 const running=agent.status==='running'||job.busy;
 $('auto-status').textContent=agent.status==='complete'?'AUTONOMOUS RUN VERIFIED':agent.status==='failed'?'RUN NEEDS ATTENTION':running?'AGENT RUNNING':'READY';
 $('auto-status').className=`pill ${agent.status==='complete'?'green':agent.status==='failed'?'red':running?'amber':'neutral'}`;
 $('auto-phase').textContent=agent.phase==='complete'?'Complete':agent.phase==='idle'?'Waiting for a goal':agent.phase.replaceAll('_',' ');
 $('auto-job').hidden=!running&&!job.error;
 $('auto-job').className=`auto-job${job.error?' failed':''}`;
 $('auto-job-title').textContent=job.error?'Autonomous run stopped':job.message||'Agent working…';
 $('auto-job-copy').textContent=job.error?job.error:'The server is orchestrating every remaining step without button clicks.';
 $('start-agent').disabled=running;
 $('reset-agent').disabled=running;
 $('agent-goal').disabled=running;
 if(document.activeElement!==$('agent-goal')&&agent.goal)$('agent-goal').value=agent.goal;
 $('agent-phases').innerHTML=(agent.phases||[]).map((phase,index)=>`<div class="agent-phase ${escape(phase.status)}"><span>${phase.status==='complete'?'✓':phase.status==='running'?'<i></i>':String(index+1).padStart(2,'0')}</span><div><strong>${escape(phase.title)}</strong><small>${escape(phase.tool)}</small></div><b>${escape(phase.status)}</b></div>`).join('');
 const toolDetails=[
  ['Liquid AI','liquid','Planner · evidence analyst · final decision',agent.plan?'USED':running?'WORKING':'WAITING',agent.links?.liquid],
  ['Nimble','nimble','Multiple live searches with source URLs',agent.search_results?.length?`${agent.search_results.length} SOURCES`:running?'WORKING':'WAITING',agent.links?.nimble],
  ['SQLite + archive','local','Memory state · scheduler · SHA-256 evidence',agent.storage?.exists?'PERSISTENT':'WAITING',''],
  ['RawTree','rawtree','Lifecycle events · remote read-back',agent.telemetry?.remote_verified?'VERIFIED':running?'PENDING':'WAITING',agent.links?.rawtree],
 ];
 $('tool-map').innerHTML=toolDetails.map(([name,tone,role,status,url])=>`<article><div><span class="tool-chip ${tone}">${escape(name)}</span><b>${escape(status)}</b></div><p>${escape(role)}</p>${url?`<a href="${safeUrl(url)}" target="_blank" rel="noreferrer">Open tool ↗</a>`:''}</article>`).join('');
 const counts=agent.storage?.counts||{};
 $('auto-metrics').innerHTML=[['Queries',agent.plan?.search_queries?.length||0],['Sources',agent.search_results?.length||0],['Tokens released',agent.archive?.tokens_removed||0],['Events',agent.events?.length||0]].map(([label,value])=>`<div><strong>${escape(value)}</strong><span>${label}</span></div>`).join('');
 const proofs=[];
 if(agent.timeline?.length)proofs.push(proofSection('Live agent decisions',`<div class="auto-timeline">${[...agent.timeline].reverse().map(item=>`<div><span>${escape(item.tool)}</span><strong>${escape(item.detail)}</strong><time>${time(item.timestamp)}</time></div>`).join('')}</div>`,agent.status==='complete'?'<span class="proof-ok">NO MANUAL STAGES</span>':'<span class="proof-wait">LIVE</span>'));
 if(agent.plan)proofs.push(proofSection('Liquid research plan',`<pre>${pretty(agent.plan)}</pre>`,'<span class="proof-ok">SCHEMA VALID</span>'));
 if(agent.search_results?.length)proofs.push(proofSection('Nimble live sources',agent.search_results.map(item=>`<a class="source-link" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><strong>${escape(item.title||item.url)}</strong><small>${escape(item.query||'live search')}</small> ↗</a>`).join(''),'<span class="proof-ok">LIVE WEB</span>'));
 if(agent.evidence_assessment)proofs.push(proofSection('Liquid analysis + source guard',`<pre>${pretty(agent.evidence_assessment)}</pre>`,`<span class="proof-ok">${agent.evidence_assessment.provenance_guard?'OFFICIAL SOURCE':'BLOCKED'}</span>`));
 if(agent.archive)proofs.push(proofSection('Memory released safely',`<div class="archive-proof"><span>▣</span><div><strong>${escape(agent.archive.pointer)}</strong><small>${escape(agent.archive.tokens_removed)} working tokens removed · ${escape(agent.archive.bytes)} archived bytes</small><code>${escape(agent.archive_file?.path||'')}</code></div></div>`,'<span class="proof-ok">SHA-256</span>'));
 if(agent.storage?.spore)proofs.push(proofSection('SQLite state',`<div class="data-table"><div><code>spores</code><span>${escape(agent.storage.spore.subject)}</span><b>${escape(agent.storage.spore.status)}</b></div>${(agent.storage.shortlist||[]).map(item=>`<div><code>shortlist</code><span>${escape(item.subject)}</span><b>ADDED</b></div>`).join('')}</div>`,'<span class="proof-ok">PERSISTENT</span>'));
 if(agent.model_result)proofs.push(proofSection('Liquid final decision',`<pre>${pretty(agent.model_result)}</pre>`,'<span class="proof-ok">GUARD PASSED</span>'));
 if(agent.telemetry)proofs.push(proofSection('RawTree remote proof',`<p>${escape(agent.telemetry.event_count)} events were sent and read back for <code>${escape(agent.run_id)}</code>.</p><div class="command-row"><code>${escape(agent.telemetry.query)}</code><button class="copy-command" data-copy="${escape(agent.telemetry.query)}" type="button">Copy SQL</button></div><a class="source-link" href="${safeUrl(agent.links.rawtree)}" target="_blank" rel="noreferrer">Open RawTree ↗</a>`,'<span class="proof-ok">VERIFIED</span>'));
 $('auto-proof').innerHTML=proofs.join('')||'<p class="empty-proof">Start the agent to see its plan, web sources, memory transitions, decisions, and remote proof.</p>';
}
function renderDemo(demo){
 if(!demo)return;
 const job=demo.job||{};
 $('demo-stage').textContent=`STAGE ${demo.stage} / 7`;
 $('demo-stage').className=`pill ${demo.stage===7?'green':demo.stage>0?'amber':'neutral'}`;
 $('demo-status').textContent=demo.stage===7?'Demonstration complete':demo.status.replaceAll('_',' ');
 $('demo-job').hidden=!job.busy&&!job.error;
 $('demo-job').className=`demo-job${job.error?' failed':''}`;
 $('demo-job-title').textContent=job.error?'Step needs attention':job.message||'Running demo step…';
 $('demo-job-copy').textContent=job.error?job.error:'Watch this panel update when the operation completes.';
 $('reset-demo').disabled=job.busy;
 $('demo-steps').innerHTML=demoSteps.map(step=>{
  const complete=demo.stage>step.stage, active=demo.stage===step.stage, running=job.busy&&job.action===step.action;
  const toolUrl=step.tone==='nimble'?demo.links.nimble:step.tone==='liquid'?demo.links.liquid:step.tone==='rawtree'?demo.links.rawtree:'';
  const mainButton=step.action==='wake-live'
   ? `<div class="step-actions"><button data-demo-action="wake-live" ${!active||job.busy?'disabled':''}>${running?'Searching…':'Run live Nimble'}</button><button class="secondary-button" data-demo-action="wake-replay" ${!active||job.busy?'disabled':''}>Use labeled replay</button></div>`
   : `<button data-demo-action="${step.action}" ${!active||job.busy?'disabled':''}>${running?'Running…':complete?'Completed':'Run this step'}</button>`;
  return `<article class="demo-step ${complete?'complete':active?'active':'locked'}"><div class="step-rail"><span>${complete?'✓':step.number}</span><i></i></div><div class="step-body"><div class="step-top"><div><span class="tool-chip ${step.tone}">${escape(step.tool)}</span><h3>${escape(step.title)}</h3></div>${toolUrl?`<a class="external-link" href="${safeUrl(toolUrl)}" target="_blank" rel="noreferrer">Open ${escape(step.tool)} ↗</a>`:''}</div><p>${escape(step.description)}</p><div class="command-row"><code>${escape(step.command)}</code><button class="copy-command" data-copy="${escape(step.command)}" type="button">Copy</button></div>${mainButton}</div></article>`;
 }).join('');
 const counts=demo.storage?.counts||{};
 $('proof-metrics').innerHTML=[['Working',counts.working||0],['Spores',counts.spores||0],['Shortlist',counts.shortlist||0],['Events',demo.events?.length||0]].map(([label,value])=>`<div><strong>${escape(value)}</strong><span>${label}</span></div>`).join('');
 const proofs=[];
 const rows=[];
 if(demo.storage?.working_memory)rows.push(['working_memories',demo.storage.working_memory.subject,'ACTIVE']);
 if(demo.storage?.spore)rows.push(['spores',demo.storage.spore.subject,demo.storage.spore.status]);
 for(const item of demo.storage?.shortlist||[])rows.push(['shortlist',item.subject,'SHORTLISTED']);
 if(demo.storage?.action)rows.push(['agent_actions',demo.storage.action.subject,demo.storage.action.action_type]);
 proofs.push(proofSection('SQLite · data/spore-demo.sqlite',rows.length?`<div class="data-table">${rows.map(row=>`<div><code>${escape(row[0])}</code><span>${escape(row[1])}</span><b>${escape(row[2])}</b></div>`).join('')}</div>`:'<p class="empty-proof">No rows yet. Run Step 1.</p>',demo.storage?.exists?'<span class="proof-ok">PERSISTENT</span>':'<span class="proof-wait">EMPTY</span>'));
 if(demo.decision)proofs.push(proofSection('Memory decision',`<pre>${pretty(demo.decision)}</pre>`,'<span class="proof-ok">VALIDATED</span>'));
 if(demo.archive?.exists)proofs.push(proofSection('Local archive',`<div class="archive-proof"><span>▣</span><div><strong>${escape(demo.archive.pointer)}</strong><small>${escape(demo.archive.bytes)} bytes · checksum verified on restore</small><code>${escape(demo.archive.path)}</code></div></div>`,'<span class="proof-ok">SAVED</span>'));
 const evidence=demo.fresh_evidence?.evidence_urls||[];
 if(evidence.length)proofs.push(proofSection(`${demo.fresh_evidence.evidence_mode==='live'?'Live Nimble':'Replay'} evidence`,evidence.map(url=>`<a class="source-link" href="${safeUrl(url)}" target="_blank" rel="noreferrer">${escape(url)} ↗</a>`).join(''),`<span class="proof-ok">${demo.fresh_evidence.evidence_mode==='live'?'LIVE':'REPLAY'}</span>`));
 if(demo.rehydrated)proofs.push(proofSection('Rehydrated context',`<pre>${pretty(demo.rehydrated)}</pre>`,'<span class="proof-ok">INTEGRITY OK</span>'));
 if(demo.model_result)proofs.push(proofSection('Liquid reevaluation',`<pre>${pretty(demo.model_result)}</pre>`,`<span class="proof-ok">${escape(demo.model_result.status)}</span>`));
 if(demo.telemetry)proofs.push(proofSection('RawTree read-back',`<p>${escape(demo.telemetry.event_count)} events verified for <code>${escape(demo.run_id)}</code>.</p><div class="command-row"><code>${escape(demo.telemetry.query)}</code><button class="copy-command" data-copy="${escape(demo.telemetry.query)}" type="button">Copy SQL</button></div><a class="source-link" href="${safeUrl(demo.links.rawtree)}" target="_blank" rel="noreferrer">Open RawTree and paste this query ↗</a>`,'<span class="proof-ok">VERIFIED</span>'));
 if(demo.events?.length)proofs.push(proofSection('Lifecycle event stream',`<div class="event-stream">${demo.events.map((event,index)=>`<div><span>${String(index+1).padStart(2,'0')}</span><strong>${escape(event.event_type.replaceAll('_',' '))}</strong><small>${escape(event.evidence_mode)}</small></div>`).join('')}</div>`));
 $('demo-proof').innerHTML=proofs.join('');
}
function render(s){
 lastState=s;
 renderAutonomous(s.autonomous);
 renderDemo(s.demo);
 $('sync-label').textContent=`Connected · refreshed ${time(s.serverTime)}`;
 $('sync-dot').style.background='var(--green)';
 $('focus').textContent=s.focus; $('summary').textContent=s.summary;
 const done=s.milestones.filter(m=>m.status==='done').length;
 $('progress-value').textContent=`${done} / ${s.milestones.length} complete`;
 $('progress-bar').style.width=(done/s.milestones.length*100)+'%';
 document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',done);
 const evaluation=s.evaluation;
 const telemetry=s.autonomous?.telemetry||s.demo?.telemetry||s.telemetry;
 const passed=evaluation?.cases?.filter(x=>x.passed).length??0, total=evaluation?.cases?.length??0;
 const liquidDemoVerified=s.autonomous?.model_result?.status==='validated'||s.demo?.model_result?.status==='validated';
 const good=liquidDemoVerified||(total>0&&passed===total&&evaluation.model===s.config.model);
 const smallModel=s.config.model.replace('hf.co/LiquidAI/','').replace('-GGUF','');
 const services=[
  {name:'Liquid AI',icon:'◒',label:!s.ollama.online?'OFFLINE':liquidDemoVerified?'DEMO VERIFIED':good?'TESTS PASSED':'NEEDS TUNING',tone:good?'green':'amber',detail:!s.ollama.online?'Open Ollama to restore local inference.':liquidDemoVerified?'The local 8B model returned a schema-valid reevaluation and agreed with the deterministic guard.':good?`${smallModel} passed ${passed}/${total} sample decisions. Broader validation remains.`:`${smallModel} is ${s.ollama.modelAvailable?'installed':'not installed'}. Classification quality is not yet validated.`,left:'MEMORY DECISIONS',right:s.ollama.online?'Local server online':'Local server offline'},
  ...['nimble','rawtree'].map((key,i)=>{const c=s.checks[key];const configured=s.config[key];const ok=configured&&c?.status==='verified';return{name:i?'RawTree':'Nimble',icon:i?'≋':'⌁',label:!configured?'KEY MISSING':ok?'VERIFIED':c?.status==='error'?'CHECK FAILED':'NOT TESTED',tone:ok?'green':'amber',detail:!configured?'Add the service key to your local .env file.':c?.detail||'Connection has not been tested.',left:i?'MEMORY ANALYTICS':'LIVE WEB RESEARCH',right:c?.checkedAt?`Checked ${time(c.checkedAt)}`:'Not checked'};})
 ];
 $('connection-count').textContent=`${services.filter(x=>x.tone==='green').length} / 3 verified`;
 $('signal-title').textContent=s.autonomous?.status==='complete'?'Autonomous lifecycle verified':telemetry?.complete?'Lifecycle proof is complete':s.ollama.online?'Local model is online':'Local model is offline';
 $('signal-copy').textContent=s.autonomous?.status==='complete'?`One goal produced ${s.autonomous.search_results.length} live sources and an independent action.`:telemetry?.complete?`${telemetry.event_count} measured events · ${telemetry.remote_verified?'RawTree read-back verified':'local replay'}`:'Waiting for a complete measured lifecycle run.';
 const html=services.map(x=>`<article class="service"><div class="service-head"><div class="service-title"><span class="service-icon">${x.icon}</span>${x.name}</div><span class="pill ${x.tone}">${x.label}</span></div><p>${escape(x.detail)}</p><div class="service-bottom"><span>${x.left}</span><span>${escape(x.right)}</span></div></article>`).join('');
 if(html!==lastMarkup){$('services').innerHTML=html;lastMarkup=html;}
 $('milestones').innerHTML=s.milestones.map((m,i)=>`<div class="milestone ${escape(m.status)}"><span class="step-number">${m.status==='done'?'✓':String(i+1).padStart(2,'0')}</span><div><div class="step-title"><span>${escape(m.title)}</span><small>${escape(m.owner)}</small></div><p>${escape(m.detail)}</p></div></div>`).join('');
 const events=[...(evaluation?[{time:evaluation.finishedAt,title:`Liquid model check: ${passed}/${total} passed`,detail:`${evaluation.model.replace('hf.co/LiquidAI/','')} · representative examples, not a full reliability benchmark.`,type:good?'success':'warning'}]:[]),...s.activity];
 $('events').innerHTML=events.slice(0,4).map(e=>`<div class="event ${escape(e.type)}"><span class="event-dot"></span><div><h3>${escape(e.title)}</h3><p>${escape(e.detail)}</p><time datetime="${escape(e.time)}">${time(e.time)}</time></div></div>`).join('');
 const missing=[];if(!s.config.nimble)missing.push('Nimble key');if(!s.config.rawtree)missing.push('RawTree key');if(!s.ollama.online)missing.push('running Ollama');
 $('next-title').textContent=missing.length?'Finish your connections.':s.autonomous?.status==='complete'?'Autonomous proof is complete.':'Start the autonomous agent.';
 $('next-copy').textContent=missing.length?`Still needed: ${missing.join(', ')}. Credentials belong in the local .env file.`:s.autonomous?.status==='complete'?'The one-command run is complete, measured, and visible on the public read-only site.':'Use the green button above. The agent will complete every stage on its own.';
 const lifecycleStatus=$('lifecycle-status');
 lifecycleStatus.textContent=telemetry?.remote_verified?'COMPLETE · VERIFIED':telemetry?.complete?'COMPLETE · LOCAL':'WAITING FOR A RUN';
 lifecycleStatus.className=`pill ${telemetry?.complete?'green':'neutral'}`;
 if(telemetry){
  const metricItems=[
   [telemetry.event_count,'Lifecycle events'],
   [telemetry.active_tokens_removed.toLocaleString(),'Working tokens released'],
   [`${telemetry.payload_reduction_percent}%`,'Archived payload → compact spore'],
   [telemetry.counts?.memory_awakened||0,'Memories awakened'],
   [telemetry.counts?.agent_action_completed||0,'Autonomous actions'],
  ];
  $('metrics').innerHTML=metricItems.map(([value,label])=>`<div class="metric"><strong>${escape(value)}</strong><span>${escape(label)}</span></div>`).join('');
 }
 $('check-button').disabled=s.busy; $('check-button').textContent=s.busy?'Checking services…':'↻  Check connections';
 $('error').hidden=true;
}
async function refresh(){try{const r=await fetch('/api/status');if(!r.ok)throw new Error();render(await r.json());}catch{$('sync-label').textContent='Connection lost · retrying';$('sync-dot').style.background='var(--amber)';$('error').textContent='The local dashboard server is unavailable. Previously displayed status may be out of date.';$('error').hidden=false;}}
$('check-button').addEventListener('click',async()=>{ $('check-button').disabled=true;try{const r=await fetch('/api/check',{method:'POST'});if(!r.ok)throw new Error();await refresh();}catch{$('error').textContent='Could not start the checks. Try again when the local server is available.';$('error').hidden=false;$('check-button').disabled=false;}});
async function autonomousRequest(path,body={}){
 try{
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||'Could not start the autonomous agent.');
  await refresh();
 }catch(error){$('error').textContent=error.message;$('error').hidden=false;}
}
$('start-agent').addEventListener('click',()=>autonomousRequest('/api/autonomous/start',{goal:$('agent-goal').value}));
$('reset-agent').addEventListener('click',()=>autonomousRequest('/api/autonomous/reset'));
async function runDemoAction(action){
 try{
  const response=await fetch(`/api/demo/${action}`,{method:'POST'});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||'Could not start this demo step.');
  await refresh();
  for(let attempt=0;attempt<180;attempt+=1){
   await new Promise(resolve=>setTimeout(resolve,500));
   await refresh();
   if(!lastState?.demo?.job?.busy)break;
  }
 }catch(error){$('error').textContent=error.message;$('error').hidden=false;await refresh();}
}
document.addEventListener('click',async event=>{
 const actionButton=event.target.closest('[data-demo-action]');
 if(actionButton){await runDemoAction(actionButton.dataset.demoAction);return;}
 const copyButton=event.target.closest('[data-copy]');
 if(copyButton){await navigator.clipboard.writeText(copyButton.dataset.copy);const old=copyButton.textContent;copyButton.textContent='Copied';setTimeout(()=>{copyButton.textContent=old;},1200);}
});
function countdown(){const diff=new Date('2026-09-25T16:30:00-07:00')-Date.now();if(diff<=0){$('countdown').textContent='Deadline passed';return;}const mins=Math.floor(diff/60000);$('countdown').textContent=`${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m left`;}
countdown();setInterval(countdown,1000);refresh();setInterval(refresh,5000);
const toolContext=document.modelContext;
if(toolContext?.registerTool){
 const lifecycle=new AbortController();
 Promise.resolve(toolContext.registerTool({name:'read_spore_build_status',description:'Read SPORE development milestones, missing setup, recorded connection checks, and lifecycle metrics without spending API credits.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');await refresh();if(!lastState)throw new Error('Local project status unavailable.');return {focus:lastState.focus,milestones:lastState.milestones,checks:lastState.checks,telemetry:lastState.telemetry,model:lastState.config.model,ollamaOnline:lastState.ollama.online};}},{signal:lifecycle.signal})).catch(()=>{});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
