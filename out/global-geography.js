export const wrapLongitude=lon=>((lon+180)%360+360)%360-180;
export function areaFromCorners(a,b){
  if(![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite)||Math.abs(a.lat)>90||Math.abs(b.lat)>90)throw new Error('Esquinas inválidas.');
  const x=wrapLongitude(a.lng),y=x+wrapLongitude(b.lng-x),west=Math.min(x,y),east=Math.max(x,y),south=Math.min(a.lat,b.lat),north=Math.max(a.lat,b.lat);
  if(east-west<.00001||north-south<.00001)throw new Error('Elegí dos esquinas distintas para formar una zona.');
  return {south,north,west,east,center:{lat:(south+north)/2,lon:wrapLongitude((west+east)/2)},scope:'visual-selection-only-not-area-aggregation'};
}
