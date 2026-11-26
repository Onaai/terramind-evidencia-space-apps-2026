const memory=new Map();let database;
async function open(){
  if(!database)database=new Promise(resolve=>{try{const r=indexedDB.open('terramind-nasa-v4',1);r.onupgradeneeded=()=>r.result.createObjectStore('blocks',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);r.onblocked=()=>resolve(null);}catch{resolve(null);}});
  return database;
}
export async function readBlock(key){
  const db=await open();if(!db)return memory.get(key)||null;
  return new Promise(resolve=>{try{const req=db.transaction('blocks').objectStore('blocks').get(key);req.onsuccess=()=>resolve(req.result&&Date.now()-req.result.savedAt<30*86400000?req.result.value:null);req.onerror=()=>resolve(null);}catch{resolve(null);}});
}
export async function writeBlock(key,value){
  const db=await open();if(!db){memory.set(key,value);return;}
  await new Promise(resolve=>{try{const tx=db.transaction('blocks','readwrite');tx.objectStore('blocks').put({key,value,savedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;}catch{resolve();}});
}
export async function clearBlocks(){memory.clear();const db=await open();if(db)await new Promise(resolve=>{const tx=db.transaction('blocks','readwrite');tx.objectStore('blocks').clear();tx.oncomplete=resolve;tx.onerror=resolve;});}
export async function storageAvailable(){return !!await open();}
