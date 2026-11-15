import test from 'node:test';
import assert from 'node:assert/strict';
import {chartRows,lineSegments,escapeHtml,formatP} from '../out/evidence-charts.js';
test('No une la línea a través de observaciones excluidas',()=>{
  const result={series:[{accepted:true,value:.5},{accepted:false,value:.9},{accepted:true,value:.6}]};
  const rows=chartRows(result,'series');
  assert.deepEqual(rows.map(r=>r.displayValue),[.5,null,.6]);
  assert.deepEqual(lineSegments(rows,r=>r.displayValue,i=>i,v=>v),[[[0,.5]],[[2,.6]]]);
});
test('La anomalía ausente no se transforma en cero',()=>{
  const rows=chartRows({series:[{anomaly:null},{anomaly:0},{anomaly:-.1}]},'anomaly');
  assert.deepEqual(rows.map(r=>r.displayValue),[null,0,-.1]);
});
test('Resumen anual usa el valor apto y no media parcial excluida',()=>{
  const rows=chartRows({annual:[{year:2020,value:null,meanOfAvailable:.7,accepted:false}]},'annual');
  assert.equal(rows[0].displayValue,null);
  assert.equal(rows[0].date,'2020-01-01');
});
test('Textos dinámicos se escapan antes de insertarlos en SVG/HTML',()=>{
  assert.equal(escapeHtml('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');
});
test('Un p-valor pequeño nunca se rotula como cero',()=>{
  assert.equal(formatP(.00000004),'<0,0001');
  assert.equal(formatP(null),'No informado');
  assert.equal(formatP(.05),'0,0500');
});
