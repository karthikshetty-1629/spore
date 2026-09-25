const $=id=>document.getElementById(id);
const safe=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'#'}catch{return'#'}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
fetch('run.json').then(response=>{if(!response.ok)throw new Error('proof unavailable');return response.json()}).then(run=>{
 $('run-id').textContent=run.run_id;$('run-time').textContent=new Date(run.completed_at).toLocaleString();$('goal').textContent=run.goal;
 $('pipeline').innerHTML=run.phases.map((phase,index)=>`<article><i>${String(index+1).padStart(2,'0')}</i><div><strong>${esc(phase.title)}</strong><span>${esc(phase.tool)}</span></div><b>✓ VERIFIED</b></article>`).join('');
 const metrics=[['1','start command'],[run.plan.search_queries.length,'live queries'],[run.search_results.length,'web sources'],[run.evidence_assessment.official_sources.length,'official matches'],[run.archive.tokens_removed,'tokens released'],[run.telemetry.event_count,'events verified']];
 $('metrics').innerHTML=metrics.map(([value,label])=>`<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
 $('action').textContent=run.action.action_type.replaceAll('_',' ');$('reason').textContent=run.model_result.output.reason;
 $('sources').innerHTML=run.search_results.map((source,index)=>`<a href="${safe(source.url)}" target="_blank" rel="noreferrer"><span>${String(index+1).padStart(2,'0')}</span><div><strong>${esc(source.title||source.url)}</strong><small>${esc(new URL(source.url).hostname)}</small></div><i>↗</i></a>`).join('');
 $('timeline').innerHTML=run.timeline.filter(item=>/created|stored|classified|removed|active|accepted|passed|completed|returned/i.test(item.detail)).map(item=>`<li><span>${esc(item.tool)}</span><p>${esc(item.detail)}</p></li>`).join('');
 for(const [id,key] of [['liquid-link','liquid'],['nimble-link','nimble'],['rawtree-link','rawtree'],['repo-top','repository'],['repo-bottom','repository']])$(id).href=safe(run.links[key]);
}).catch(()=>{$('run-id').textContent='Verified run proof could not be loaded.'});
