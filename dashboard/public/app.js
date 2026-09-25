const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastState=null, lastMarkup='';
const time=s=>s?new Date(s).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not yet checked';
function render(s){
 lastState=s;
 $('sync-label').textContent=`Connected · refreshed ${time(s.serverTime)}`;
 $('sync-dot').style.background='var(--green)';
 $('focus').textContent=s.focus; $('summary').textContent=s.summary;
 const done=s.milestones.filter(m=>m.status==='done').length;
 $('progress-value').textContent=`${done} / ${s.milestones.length} complete`;
 $('progress-bar').style.width=(done/s.milestones.length*100)+'%';
 document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',done);
 const evaluation=s.evaluation;
 const telemetry=s.telemetry;
 const passed=evaluation?.cases?.filter(x=>x.passed).length??0, total=evaluation?.cases?.length??0;
 const good=total>0&&passed===total&&evaluation.model===s.config.model;
 const smallModel=s.config.model.replace('hf.co/LiquidAI/','').replace('-GGUF','');
 const services=[
  {name:'Liquid AI',icon:'◒',label:!s.ollama.online?'OFFLINE':good?'TESTS PASSED':'NEEDS TUNING',tone:good?'green':'amber',detail:!s.ollama.online?'Open Ollama to restore local inference.':good?`${smallModel} passed ${passed}/${total} sample decisions. Broader validation remains.`:`${smallModel} is ${s.ollama.modelAvailable?'installed':'not installed'}. Classification quality is not yet validated.`,left:'MEMORY DECISIONS',right:s.ollama.online?'Local server online':'Local server offline'},
  ...['nimble','rawtree'].map((key,i)=>{const c=s.checks[key];const configured=s.config[key];const ok=configured&&c?.status==='verified';return{name:i?'RawTree':'Nimble',icon:i?'≋':'⌁',label:!configured?'KEY MISSING':ok?'VERIFIED':c?.status==='error'?'CHECK FAILED':'NOT TESTED',tone:ok?'green':'amber',detail:!configured?'Add the service key to your local .env file.':c?.detail||'Connection has not been tested.',left:i?'MEMORY ANALYTICS':'LIVE WEB RESEARCH',right:c?.checkedAt?`Checked ${time(c.checkedAt)}`:'Not checked'};})
 ];
 $('connection-count').textContent=`${services.filter(x=>x.tone==='green').length} / 3 verified`;
 $('signal-title').textContent=telemetry?.complete?'Lifecycle proof is complete':s.ollama.online?'Local model is online':'Local model is offline';
 $('signal-copy').textContent=telemetry?.complete?`${telemetry.event_count} measured events · ${telemetry.remote_verified?'RawTree read-back verified':'local replay'}`:'Waiting for a complete measured lifecycle run.';
 const html=services.map(x=>`<article class="service"><div class="service-head"><div class="service-title"><span class="service-icon">${x.icon}</span>${x.name}</div><span class="pill ${x.tone}">${x.label}</span></div><p>${escape(x.detail)}</p><div class="service-bottom"><span>${x.left}</span><span>${escape(x.right)}</span></div></article>`).join('');
 if(html!==lastMarkup){$('services').innerHTML=html;lastMarkup=html;}
 $('milestones').innerHTML=s.milestones.map((m,i)=>`<div class="milestone ${escape(m.status)}"><span class="step-number">${m.status==='done'?'✓':String(i+1).padStart(2,'0')}</span><div><div class="step-title"><span>${escape(m.title)}</span><small>${escape(m.owner)}</small></div><p>${escape(m.detail)}</p></div></div>`).join('');
 const events=[...(evaluation?[{time:evaluation.finishedAt,title:`Liquid model check: ${passed}/${total} passed`,detail:`${evaluation.model.replace('hf.co/LiquidAI/','')} · representative examples, not a full reliability benchmark.`,type:good?'success':'warning'}]:[]),...s.activity];
 $('events').innerHTML=events.slice(0,4).map(e=>`<div class="event ${escape(e.type)}"><span class="event-dot"></span><div><h3>${escape(e.title)}</h3><p>${escape(e.detail)}</p><time datetime="${escape(e.time)}">${time(e.time)}</time></div></div>`).join('');
 const missing=[];if(!s.config.nimble)missing.push('Nimble key');if(!s.config.rawtree)missing.push('RawTree key');if(!s.ollama.online)missing.push('running Ollama');
 $('next-title').textContent=missing.length?'Finish your connections.':telemetry?.remote_verified?'Rehearse the three-minute demo.':'Verify the lifecycle telemetry.';
 $('next-copy').textContent=missing.length?`Still needed: ${missing.join(', ')}. Credentials belong in the local .env file.`:telemetry?.remote_verified?'The full replay loop is measured and visible. Next, polish the narrative, record the video, and submit.':'Run the telemetry demo to record the complete sleep, wake, rehydrate, and action sequence.';
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
function countdown(){const diff=new Date('2026-09-25T16:30:00-07:00')-Date.now();if(diff<=0){$('countdown').textContent='Deadline passed';return;}const mins=Math.floor(diff/60000);$('countdown').textContent=`${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m left`;}
countdown();setInterval(countdown,1000);refresh();setInterval(refresh,5000);
const toolContext=document.modelContext;
if(toolContext?.registerTool){
 const lifecycle=new AbortController();
 Promise.resolve(toolContext.registerTool({name:'read_spore_build_status',description:'Read SPORE development milestones, missing setup, recorded connection checks, and lifecycle metrics without spending API credits.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');await refresh();if(!lastState)throw new Error('Local project status unavailable.');return {focus:lastState.focus,milestones:lastState.milestones,checks:lastState.checks,telemetry:lastState.telemetry,model:lastState.config.model,ollamaOnline:lastState.ollama.online};}},{signal:lifecycle.signal})).catch(()=>{});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
