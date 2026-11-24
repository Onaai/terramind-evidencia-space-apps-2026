import test from 'node:test';
import assert from 'node:assert/strict';
import {areaFromCorners,wrapLongitude} from '../out/global-geography.js';
import {geocodingURL} from '../api/places.js';
test('zone corners work in either order and preserve area scope',()=>{const a=areaFromCorners({lat:-31,lng:-65},{lat:-32,lng:-64}),b=areaFromCorners({lat:-32,lng:-64},{lat:-31,lng:-65});assert.deepEqual(a,b);assert.equal(a.center.lat,-31.5);assert.equal(a.center.lon,-64.5);assert.equal(a.scope,'area-weighted-rectangle');});
test('zones crossing the dateline use the short interval, not almost the whole planet',()=>{const a=areaFromCorners({lat:10,lng:179},{lat:12,lng:-179});assert.equal(a.east-a.west,2);assert.equal(a.center.lon,-180);assert.equal(wrapLongitude(541),-179);});
test('invalid and degenerate zones rejected',()=>{for(const [a,b] of [[{lat:91,lng:1},{lat:10,lng:2}],[{lat:10,lng:1},{lat:10,lng:2}],[{lat:10,lng:1},{lat:11,lng:1}]])assert.throws(()=>areaFromCorners(a,b));});
test('geocoding query remains encoded on a fixed upstream',()=>{const u=new URL(geocodingURL('Córdoba, Argentina'));assert.equal(u.hostname,'geocoding-api.open-meteo.com');assert.equal(u.searchParams.get('name'),'Córdoba, Argentina');assert.throws(()=>geocodingURL('a'));assert.throws(()=>geocodingURL(null));});
