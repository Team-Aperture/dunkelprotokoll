#!/usr/bin/env node
/* ============================================================================
   Hand-authoring / encoder tool for "Dunkelprotokoll".

   Level data ships ENCODED inside index.html so reading the page source or the
   console reveals nothing about the dark maze. This tool lets you hand-author
   floors as plain data, validates them, and prints the blob to paste into
   index.html (replace the LEVEL_BLOB value).

   For procedurally generated multi-floor mazes use tools/generate-maze.js
   instead. This file is the hand-crafted path and ships a single EXAMPLE floor
   you can edit or duplicate.

   ENGINE DATA SHAPE:
     { coordTemplate: "...{}...",   // each {} filled left-to-right by page frags (slot order)
       floors: [ {                  // floor 0 = top, last floor = bottom
         name, w, h, spawnFacing(0=N 1=E 2=S 3=W),
         grid:[ "..." rows: # wall  . floor  S spawn  E exit  C checkpoint ],
         doors:[{x,y,id}], buttons:[{x,y,id,opens:[doorId]}],   // button x,y is the WALL it sits on
         pages:[{x,y,id,slot,frag}],  checkpoint:{x,y},
         up:{x,y}|null,    // arrival cell when descending into this floor (ladder up)
         down:{x,y}|null,  // ladder down to the next floor (gated); null on last floor
         exit:{x,y}|null   // final exit (last floor only)
       }, ... ] }

   USAGE:  node tools/encode-level.js   (paste blob -> index.html LEVEL_BLOB)
   ============================================================================ */

const KEY = "K4l1br1erungsanlage-Dunkelprotokoll";   // must match index.html LEVEL_KEY
const coordTemplate = "N 49° {}{}.{}{}{}  E 012° {}{}.{}{}{}";

// ---- author your floors here (this example is a single, self-contained floor) ----
const FLOORS = [
  {
    name: "BEISPIEL-EBENE (Vorlage)",
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
    // ladders: single-floor example, so no up/down. exit is auto-filled from 'E'.
    up: null, down: null,
  },
];

const N4=[[0,-1],[1,0],[0,1],[-1,0]];
function findChar(g,ch){ for(let y=0;y<g.length;y++){ const x=g[y].indexOf(ch); if(x>=0) return {x,y}; } return null; }

// finalize floor fields (w/h/checkpoint/exit) and validate solvability
function finalize(fl, idx, isLast){
  const g=fl.grid, H=g.length, W=g[0].length, errs=[];
  g.forEach((r,i)=>{ if(r.length!==W) errs.push(`F${idx} row ${i} length ${r.length}!=${W}`); });
  const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?'#':g[y][x];
  const key=(x,y)=>x+","+y;
  fl.w=W; fl.h=H;
  fl.checkpoint = findChar(g,'C');
  const exitC = findChar(g,'E');
  if(isLast){ fl.exit = exitC; } else { fl.exit = null; }
  const entry = idx===0 ? findChar(g,'S') : fl.up;
  const target = fl.exit || fl.down;
  if(!entry) errs.push(`F${idx}: no entry (S or up)`);
  if(!target) errs.push(`F${idx}: no target (E or down)`);
  if(!fl.checkpoint) errs.push(`F${idx}: no checkpoint C`);
  if(errs.length) return errs;

  const doorSet=open=>new Set(open?[]:fl.doors.map(d=>key(d.x,d.y)));
  const bfs=open=>{ const bd=doorSet(open),seen={}; seen[key(entry.x,entry.y)]=true; const q=[entry];
    while(q.length){ const{x,y}=q.shift(); for(const[dx,dy]of N4){ const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(seen[k]||at(nx,ny)==='#'||bd.has(k))continue; seen[k]=true; q.push({x:nx,y:ny}); } } return seen; };
  const closed=bfs(false), open=bfs(true), has=(s,x,y)=>!!s[key(x,y)];
  for(const b of fl.buttons){
    if(at(b.x,b.y)!=='#') errs.push(`F${idx} button ${b.id} not on a wall`);
    const ok=N4.some(([dx,dy])=>at(b.x+dx,b.y+dy)!=='#'&&!fl.doors.some(d=>d.x===b.x+dx&&d.y===b.y+dy)&&has(closed,b.x+dx,b.y+dy));
    if(!ok) errs.push(`F${idx} button ${b.id}: no reachable press cell (doors closed)`);
  }
  for(const p of fl.pages) if(!has(open,p.x,p.y)) errs.push(`F${idx} page ${p.id} unreachable`);
  if(!has(open,target.x,target.y)) errs.push(`F${idx} target unreachable (doors open)`);
  if(has(closed,target.x,target.y)) errs.push(`F${idx} target not gated by a door`);
  if(!has(closed,fl.checkpoint.x,fl.checkpoint.y)) errs.push(`F${idx} checkpoint unreachable (closed)`);
  return errs;
}

let allErrs=[];
FLOORS.forEach((fl,i)=> allErrs=allErrs.concat(finalize(fl,i,i===FLOORS.length-1)));
// cross-floor + slot/digit checks
const slots=new Set(); let dup=false;
FLOORS.forEach(f=>f.pages.forEach(p=>{ if(slots.has(p.slot)) dup=true; slots.add(p.slot); }));
if(dup) allErrs.push("duplicate page slot across floors");
const totalDigits=FLOORS.reduce((n,f)=>n+f.pages.reduce((m,p)=>m+String(p.frag).length,0),0);
const blanks=(coordTemplate.match(/\{\}/g)||[]).length;
if(blanks!==totalDigits) allErrs.push(`coordTemplate has ${blanks} slots but pages supply ${totalDigits} digits`);

if(allErrs.length){ console.error("VALIDATION FAILED:\n - "+allErrs.join("\n - ")); process.exit(1); }

const LEVELS={ coordTemplate, floors:FLOORS };

const enc=new TextEncoder(),dec=new TextDecoder(),kb=enc.encode(KEY);
const xorB=b=>{const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b[i]^kb[i%kb.length];return o;};
const json=JSON.stringify(LEVELS);
const blob=Buffer.from(xorB(enc.encode(json))).toString("base64");
if(dec.decode(xorB(Uint8Array.from(Buffer.from(blob,"base64"))))!==json){ console.error("round-trip failed"); process.exit(1); }

const frags=FLOORS.flatMap(f=>f.pages).sort((a,b)=>a.slot-b.slot).map(p=>p.frag).join("");
let i=0; const coords=coordTemplate.replace(/\{\}/g,()=>frags[i++]);
console.log("Validation: OK  |  floors:", FLOORS.length, " pages:", slots.size);
console.log("Assembled coordinates preview:", coords);
console.log("\nPaste into index.html (var LEVEL_BLOB):\n");
const parts=[]; for(let p=0;p<blob.length;p+=74) parts.push('      "'+blob.slice(p,p+74)+'"');
console.log("    var LEVEL_BLOB =\n"+parts.join(" +\n")+";");
