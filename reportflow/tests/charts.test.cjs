const assert=require('node:assert/strict');global.ReportFlow=require('../src/import-model.js');global.BatchCore=require('../src/batch-core.js');const charts=require('../src/charts.js'),C=BatchCore;
assert.equal(charts.ceiling([0,0]),1);assert.equal(charts.ceiling([76890,70995]),80000);
const r=C.summarize(C.demo(),'Officine Emilia','2026-Q3'),html=charts.monthly(r);assert.ok(html.includes('rif. 2026-04'));assert.ok(html.includes('stroke-dasharray'));assert.equal((html.match(/data-month=/g)||[]).length,3);
const absent=charts.monthly({...r,priorMonthly:null});assert.ok(absent.includes('Confronto non disponibile'));assert.ok(!absent.includes('rif. 2026-04'));
const zeros=charts.monthly({...r,monthly:r.monthly.map(m=>({...m,cost:0})),priorMonthly:null});assert.ok(!/NaN|Infinity/.test(zeros));
assert.ok(charts.horizontal([{name:'<script>',total:0}],0,'test').includes('&lt;script&gt;'));
console.log('PASS: scale zero, reference coverage, month targets, escaping, no non-finite coordinates.');
