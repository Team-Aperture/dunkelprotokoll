#!/usr/bin/env node
/* ============================================================================
   Level encoder / authoring tool for "Dunkelprotokoll".

   Level data is shipped ENCODED inside index.html so that reading the page
   source or poking the browser console reveals nothing about the dark maze
   (no plaintext grid, page numbers, or coordinates). This script lets you
   author levels as plain data, validates them, and prints the blob to paste
   into index.html (replace the LEVEL_BLOB value).

   USAGE:
     1. Edit the LEVEL object below (grid + overlays). Schema:
          name          : string
          spawnFacing   : 0=N 1=E 2=S 3=W
          grid          : array of equal-length rows using:
                            #  wall      .  floor
                            S  spawn     E  exit      C  checkpoint
          doors         : [ {x,y,id} ]                 // blocks its cell until opened
          buttons       : [ {x,y,id,opens:[doorId]} ]  // x,y is the WALL it sits on;
                                                        // pressed from the adjacent floor cell
          pages         : [ {x,y,id,slot,frag} ]       // frag = digit fragment shown on the page
          coordTemplate : string; each "{}" is filled left-to-right by page
                          frags in ascending slot order.
     2. Run:  node tools/encode-level.js
     3. Copy the printed blob into index.html  ->  var LEVEL_BLOB = "...";
        (Keep LEVEL_KEY in index.html identical to KEY below.)
   ============================================================================ */

const KEY = "K4l1br1erungsanlage-Dunkelprotokoll";

const LEVEL = {
  name: "ANLAGE 1 — KALIBRIERUNGSEBENE",
  spawnFacing: 1,
  grid: [
    "###########",
    "#S........#",
    "#.#.#.#.#.#",
    "#.#.#.#.#.#",
    "#...C.....#",
    "#.#.#.#.#.#",
    "#.#.#.#.###",
    "#........E#",
    "###########",
  ],
  doors:   [ {x:8, y:7, id:"d1"} ],
  buttons: [ {x:4, y:3, id:"b1", opens:["d1"]} ],
  pages: [
    {x:9,y:1,id:"p0",slot:0,frag:"18"},
    {x:1,y:7,id:"p1",slot:1,frag:"53"},
    {x:7,y:3,id:"p2",slot:2,frag:"72"},
    {x:3,y:5,id:"p3",slot:3,frag:"40"},
    {x:9,y:5,id:"p4",slot:4,frag:"69"},
  ],
  coordTemplate: "N 49° {}{}.{}{}{}  E 012° {}{}.{}{}{}",
};

/* ---- validation (catches bad maps before you ship them) ---- */
function validate(L){
  const g=L.grid, H=g.length, W=g[0].length, errs=[];
  g.forEach((r,i)=>{ if(r.length!==W) errs.push(`row ${i} length ${r.length} != ${W}`); });
  const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?'#':g[y][x];
  const find=c=>{for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y][x]===c)return{x,y};return null;};
  const spawn=find('S'), exit=find('E');
  if(!spawn) errs.push("no spawn 'S'");
  if(!exit)  errs.push("no exit 'E'");
  if(!spawn||!exit) return {errs};
  const doorSet=open=>new Set(open?[]:L.doors.map(d=>d.x+","+d.y));
  const bfs=open=>{const bd=doorSet(open),seen=new Set([spawn.x+","+spawn.y]),q=[spawn];
    while(q.length){const{x,y}=q.shift();for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){
      const nx=x+dx,ny=y+dy,k=nx+","+ny;if(seen.has(k)||at(nx,ny)==='#'||bd.has(k))continue;
      seen.add(k);q.push({x:nx,y:ny});}}return seen;};
  const closed=bfs(false), open=bfs(true), has=(s,x,y)=>s.has(x+","+y);
  for(const b of L.buttons){
    if(at(b.x,b.y)!=='#') errs.push(`button ${b.id} is not on a wall`);
    const ok=[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>at(b.x+dx,b.y+dy)!=='#' &&
      !L.doors.some(d=>d.x===b.x+dx&&d.y===b.y+dy) && has(closed,b.x+dx,b.y+dy));
    if(!ok) errs.push(`button ${b.id} has no reachable press cell (doors closed)`);
  }
  for(const p of L.pages) if(!has(open,p.x,p.y)) errs.push(`page ${p.id} unreachable`);
  if(!has(open,exit.x,exit.y)) errs.push("exit unreachable with doors open");
  const slots=new Set();
  for(const p of L.pages){ if(slots.has(p.slot)) errs.push(`duplicate page slot ${p.slot}`); slots.add(p.slot); }
  const blanks=(L.coordTemplate.match(/\{\}/g)||[]).length;
  const digits=L.pages.reduce((n,p)=>n+String(p.frag).length,0);
  if(blanks!==digits) errs.push(`coordTemplate has ${blanks} slots but pages supply ${digits} digits`);
  return {errs, spawn, exit};
}

const {errs} = validate(LEVEL);
if(errs.length){
  console.error("LEVEL VALIDATION FAILED:\n - " + errs.join("\n - "));
  process.exit(1);
}

/* ---- encode (UTF-8 byte XOR + base64) ---- */
const enc=new TextEncoder(), dec=new TextDecoder(), kb=enc.encode(KEY);
const xorBytes=bytes=>{const o=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)o[i]=bytes[i]^kb[i%kb.length];return o;};
const json=JSON.stringify(LEVEL);
const blob=Buffer.from(xorBytes(enc.encode(json))).toString("base64");

/* round-trip sanity */
const back=dec.decode(xorBytes(Uint8Array.from(Buffer.from(blob,"base64"))));
if(back!==json){ console.error("round-trip mismatch — aborting"); process.exit(1); }

/* assembled coordinate preview */
const frags=LEVEL.pages.slice().sort((a,b)=>a.slot-b.slot).map(p=>p.frag).join("");
let i=0; const coords=LEVEL.coordTemplate.replace(/\{\}/g,()=>frags[i++]);

console.log("Validation: OK");
console.log("Assembled coordinates preview:", coords);
console.log("\nPaste into index.html (var LEVEL_BLOB):\n");
// print wrapped as a JS string concatenation (74 chars per chunk)
const chunk=74, parts=[];
for(let p=0;p<blob.length;p+=chunk) parts.push('  "'+blob.slice(p,p+chunk)+'"');
console.log(parts.join(" +\n") + ";");
