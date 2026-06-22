#!/usr/bin/env node
/* ============================================================================
   Procedural maze generator for "Dunkelprotokoll" — MULTI-FLOOR.

   Generates THREE linked, solvable floors (perfect mazes via recursive
   backtracker), connected by ladders, with a door-gated descent on each floor
   and a final door-gated exit on the bottom floor. Pages are spread across all
   floors and assemble the coordinates only when every page on every floor is
   found. Validates solvability per floor, then prints the encoded blob to paste
   into index.html.

   The maze is never stored as plaintext in the repo — only the algorithm +
   seeds — so browsing the repo or the page source still doesn't hand you the
   dark maze.

   USAGE:  node tools/generate-maze.js   (paste blob -> index.html LEVEL_BLOB)
   ============================================================================ */

const KEY = "K4l1br1erungsanlage-Dunkelprotokoll";   // must match index.html LEVEL_KEY
const DIGITS = "1853724069";                          // 10 placeholder coord digits
const TEMPLATE = "N 49° {}{}.{}{}{}  E 012° {}{}.{}{}{}";

// per-floor: [width, height, seed, [page slot indices]]  — floors get bigger/harder
const FLOOR_SPECS = [
  [19, 15, 11, [0, 1, 2]],
  [21, 17, 22, [3, 4, 5]],
  [23, 19, 33, [6, 7, 8, 9]],
];

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }

const N4=[[0,-1],[1,0],[0,1],[-1,0]];

// Build one solvable floor. Returns floor data or null if seed unusable.
function genFloor(W,H,seed,slots){
  const rng=mulberry32(seed);
  const g=[]; for(let y=0;y<H;y++) g.push(new Array(W).fill('#'));
  const key=(x,y)=>x+","+y, visited={};
  const CARVE=[[0,-2],[2,0],[0,2],[-2,0]];
  let stack=[[1,1]]; visited[key(1,1)]=true; g[1][1]='.';
  while(stack.length){
    const [cx,cy]=stack[stack.length-1], opts=[];
    for(const [dx,dy] of CARVE){ const nx=cx+dx,ny=cy+dy;
      if(nx>0&&ny>0&&nx<W-1&&ny<H-1&&!visited[key(nx,ny)]) opts.push([nx,ny,dx,dy]); }
    if(!opts.length){ stack.pop(); continue; }
    const [nx,ny,dx,dy]=opts[Math.floor(rng()*opts.length)];
    g[cy+dy/2][cx+dx/2]='.'; g[ny][nx]='.'; visited[key(nx,ny)]=true; stack.push([nx,ny]);
  }
  const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?'#':g[y][x];
  const isFloor=(x,y)=>at(x,y)!=='#';
  const deg=(x,y)=>N4.reduce((n,[dx,dy])=>n+(isFloor(x+dx,y+dy)?1:0),0);
  const key2=(x,y)=>x+","+y;

  function dists(sx,sy){ const d={}; d[key2(sx,sy)]=0; const q=[[sx,sy]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy;
      if(isFloor(nx,ny)&&d[key2(nx,ny)]===undefined){ d[key2(nx,ny)]=d[key2(x,y)]+1; q.push([nx,ny]); } } }
    return d; }

  const entry={x:1,y:1};
  const dist=dists(entry.x,entry.y);
  const deadends=[];
  for(let y=1;y<H;y+=2) for(let x=1;x<W;x+=2) if(deg(x,y)===1) deadends.push({x,y,d:dist[key2(x,y)]||0});
  deadends.sort((a,b)=>b.d-a.d);
  if(deadends.length < slots.length+2) return null;

  // gated target = farthest dead-end; door on its single passage
  const target=deadends[0];
  const od=N4.find(([dx,dy])=>isFloor(target.x+dx,target.y+dy));
  const door={x:target.x+od[0], y:target.y+od[1], id:"d1"};

  const used=new Set([key2(target.x,target.y)]);
  // pages = spread dead-ends
  let pool=deadends.slice(1);
  const pageCells=[pool.shift()];
  while(pageCells.length<slots.length && pool.length){
    let best=-1,bi=0;
    pool.forEach((c,i)=>{ const md=Math.min(...pageCells.map(p=>Math.abs(p.x-c.x)+Math.abs(p.y-c.y)));
      if(md>best){best=md;bi=i;} });
    pageCells.push(pool.splice(bi,1)[0]);
  }
  if(pageCells.length<slots.length) return null;
  pageCells.forEach(c=>used.add(key2(c.x,c.y)));

  const closedReach=(function(){ const blocked=new Set([key2(door.x,door.y)]), seen={};
    seen[key2(entry.x,entry.y)]=true; const q=[[entry.x,entry.y]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy,k=key2(nx,ny);
      if(seen[k]||!isFloor(nx,ny)||blocked.has(k)) continue; seen[k]=true; q.push([nx,ny]); } } return seen; })();

  const btnCell=deadends.find(c=>!used.has(key2(c.x,c.y))&&closedReach[key2(c.x,c.y)]&&!(c.x===entry.x&&c.y===entry.y));
  if(!btnCell) return null; used.add(key2(btnCell.x,btnCell.y));
  const bo=N4.find(([dx,dy])=>isFloor(btnCell.x+dx,btnCell.y+dy));
  const button={x:btnCell.x-bo[0], y:btnCell.y-bo[1], id:"b1", opens:["d1"]};

  const maxD=Math.max(...Object.values(dist));
  let cp=null,bestDiff=1e9;
  for(let y=1;y<H;y+=2) for(let x=1;x<W;x+=2){ const k=key2(x,y);
    if(used.has(k)||(x===entry.x&&y===entry.y)||!closedReach[k]) continue;
    const diff=Math.abs((dist[k]||0)-maxD*0.5); if(diff<bestDiff){bestDiff=diff; cp={x,y};} }
  if(!cp) return null;

  let facing=1;
  if(isFloor(entry.x+1,entry.y)) facing=1; else if(isFloor(entry.x,entry.y+1)) facing=2;
  else if(isFloor(entry.x-1,entry.y)) facing=3; else facing=0;

  const pages=pageCells.map((c,i)=>({x:c.x,y:c.y,id:"p"+slots[i],slot:slots[i],frag:DIGITS[slots[i]]}));

  // validate
  const bfs=open=>{ const bd=new Set(open?[]:[key2(door.x,door.y)]), seen={};
    seen[key2(entry.x,entry.y)]=true; const q=[[entry.x,entry.y]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy,k=key2(nx,ny);
      if(seen[k]||at(nx,ny)==='#'||bd.has(k)) continue; seen[k]=true; q.push([nx,ny]); } } return seen; };
  const closed=bfs(false), open=bfs(true), errs=[];
  if(at(button.x,button.y)!=='#') errs.push("button not on wall");
  if(!N4.some(([dx,dy])=>at(button.x+dx,button.y+dy)!=='#'&&!(button.x+dx===door.x&&button.y+dy===door.y)&&closed[key2(button.x+dx,button.y+dy)])) errs.push("button unreachable closed");
  pages.forEach(p=>{ if(!open[key2(p.x,p.y)]) errs.push("page "+p.id+" unreachable"); });
  if(!open[key2(target.x,target.y)]) errs.push("target unreachable open");
  if(closed[key2(target.x,target.y)]) errs.push("target not gated");
  if(!closed[key2(cp.x,cp.y)]) errs.push("checkpoint unreachable closed");
  if(errs.length) return null;

  return { grid:g.map(r=>r.join("")), w:W, h:H, spawnFacing:facing, entry, target,
    doors:[door], buttons:[button], pages, checkpoint:cp, pathLen:dist[key2(target.x,target.y)]||0 };
}

// Assemble the three floors, linking ladders.
function buildAll(){
  const floors=[];
  for(let i=0;i<FLOOR_SPECS.length;i++){
    const [W,H,seed,slots]=FLOOR_SPECS[i];
    let f=null;
    for(let s=seed;s<seed+500;s++){ f=genFloor(W,H,s,slots); if(f){ f.seed=s; break; } }
    if(!f) return null;
    floors.push(f);
  }
  // wire up/down/exit; entry is (1,1) on each floor
  return floors.map((f,i)=>{
    const isLast = i===floors.length-1;
    const grid=f.grid.map(r=>r.split(''));
    // mark spawn on floor 0
    if(i===0) grid[1][1]='S';
    if(isLast) grid[f.target.y][f.target.x]='E';   // final exit cell
    grid[f.checkpoint.y][f.checkpoint.x]='C';
    return {
      name:"EBENE "+(i+1), w:f.w, h:f.h, spawnFacing:f.spawnFacing,
      grid:grid.map(r=>r.join('')),
      doors:f.doors, buttons:f.buttons, pages:f.pages, checkpoint:f.checkpoint,
      up:   i===0 ? null : {x:1,y:1},                 // arrive here when descending into this floor
      down: isLast ? null : {x:f.target.x, y:f.target.y}, // ladder to next floor (gated)
      exit: isLast ? {x:f.target.x, y:f.target.y} : null,
      _pathLen:f.pathLen, _seed:f.seed,
    };
  });
}

const floors=buildAll();
if(!floors){ console.error("could not generate solvable floors"); process.exit(1); }
const LEVELS={ floors, coordTemplate:TEMPLATE };

const enc=new TextEncoder(),dec=new TextDecoder(),kb=enc.encode(KEY);
const xorB=b=>{const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b[i]^kb[i%kb.length];return o;};
const json=JSON.stringify(LEVELS);
const blob=Buffer.from(xorB(enc.encode(json))).toString("base64");
if(dec.decode(xorB(Uint8Array.from(Buffer.from(blob,"base64"))))!==json){ console.error("round-trip failed"); process.exit(1); }

let i=0; const coords=TEMPLATE.replace(/\{\}/g,()=>DIGITS[i++]);
console.log("Validation: OK  |  3 floors");
floors.forEach((f,idx)=>console.log(`  Floor ${idx+1}: ${f.w}x${f.h} seed ${f._seed} | path ${f._pathLen} | pages ${f.pages.length} | up ${f.up?"y":"-"} down ${f.down?"y":"-"} exit ${f.exit?"y":"-"}`));
console.log("Total pages:", floors.reduce((n,f)=>n+f.pages.length,0), "| coords:", coords);
console.log("\nPaste into index.html (var LEVEL_BLOB):\n");
const parts=[]; for(let p=0;p<blob.length;p+=74) parts.push('      "'+blob.slice(p,p+74)+'"');
console.log("    var LEVEL_BLOB =\n"+parts.join(" +\n")+";");

require("fs").writeFileSync("/tmp/dp/blob.txt","    var LEVEL_BLOB =\n"+parts.join(" +\n")+";");
require("fs").writeFileSync("/tmp/dp/levels.json", json);
