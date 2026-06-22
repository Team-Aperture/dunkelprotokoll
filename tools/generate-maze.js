#!/usr/bin/env node
/* ============================================================================
   Procedural maze generator for "Dunkelprotokoll".

   Generates a solvable level (perfect maze via recursive backtracker), places
   spawn / exit / a door-gated exit / its button / pages / a checkpoint, then
   VALIDATES solvability and prints the encoded blob to paste into index.html.

   This is how the current shipped floor is produced. The maze is never stored
   as plaintext in the repo — only the algorithm + seed are — so browsing the
   repo or the page source still doesn't hand you the dark maze.

   USAGE:
     node tools/generate-maze.js          # uses the constants below
   Then paste the printed blob into index.html  ->  var LEVEL_BLOB = "...";

   The defaults below (21x17, START_SEED=1) reproduce the current floor exactly.
   Change W/H for a bigger/smaller maze, or START_SEED for a different layout.
   ============================================================================ */

const W = 21, H = 17;          // odd dimensions -> clean outer walls
const START_SEED = 1;          // first seed tried; first solvable maze is used
const KEY = "K4l1br1erungsanlage-Dunkelprotokoll";   // must match index.html LEVEL_KEY
const FRAGS = ["18", "53", "72", "40", "69"];         // 5 pages x 2 digits = 10
const TEMPLATE = "N 49° {}{}.{}{}{}  E 012° {}{}.{}{}{}";

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }

function build(seed){
  const rng = mulberry32(seed);
  const g = []; for(let y=0;y<H;y++) g.push(new Array(W).fill('#'));
  const cellsX=[]; for(let x=1;x<W;x+=2) cellsX.push(x);
  const cellsY=[]; for(let y=1;y<H;y+=2) cellsY.push(y);
  const key=(x,y)=>x+","+y;
  const visited={};

  // recursive backtracker (iterative)
  const DIRS=[[0,-2],[2,0],[0,2],[-2,0]];
  let stack=[[1,1]]; visited[key(1,1)]=true; g[1][1]='.';
  while(stack.length){
    const [cx,cy]=stack[stack.length-1], opts=[];
    for(const [dx,dy] of DIRS){ const nx=cx+dx, ny=cy+dy;
      if(nx>0&&ny>0&&nx<W-1&&ny<H-1&&!visited[key(nx,ny)]) opts.push([nx,ny,dx,dy]); }
    if(!opts.length){ stack.pop(); continue; }
    const [nx,ny,dx,dy]=opts[Math.floor(rng()*opts.length)];
    g[cy+dy/2][cx+dx/2]='.'; g[ny][nx]='.'; visited[key(nx,ny)]=true; stack.push([nx,ny]);
  }

  const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?'#':g[y][x];
  const isFloor=(x,y)=>at(x,y)!=='#';
  const N4=[[0,-1],[1,0],[0,1],[-1,0]];
  const deg=(x,y)=>N4.reduce((n,[dx,dy])=>n+(isFloor(x+dx,y+dy)?1:0),0);

  function bfsDist(sx,sy){ const d={}; d[key(sx,sy)]=0; const q=[[sx,sy]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy;
      if(isFloor(nx,ny)&&d[key(nx,ny)]===undefined){ d[key(nx,ny)]=d[key(x,y)]+1; q.push([nx,ny]); } } }
    return d; }

  const spawn={x:1,y:1};
  const dist=bfsDist(spawn.x,spawn.y);

  const deadends=[];
  for(const y of cellsY) for(const x of cellsX) if(deg(x,y)===1) deadends.push({x,y,d:dist[key(x,y)]||0});
  deadends.sort((a,b)=>b.d-a.d);
  if(deadends.length<7) return null;

  // exit = farthest dead-end; its single passage -> door (guaranteed gate in a tree maze)
  const exit=deadends[0];
  const openDir=N4.find(([dx,dy])=>isFloor(exit.x+dx,exit.y+dy));
  const door={x:exit.x+openDir[0], y:exit.y+openDir[1], id:"d1"};

  // pages = 5 spread-out far dead-ends
  const used=new Set([key(exit.x,exit.y)]);
  let pool=deadends.slice(1);
  const pageCells=[pool.shift()];
  while(pageCells.length<5 && pool.length){
    let best=-1,bi=0;
    pool.forEach((c,i)=>{ const md=Math.min(...pageCells.map(p=>Math.abs(p.x-c.x)+Math.abs(p.y-c.y)));
      if(md>best){best=md;bi=i;} });
    pageCells.push(pool.splice(bi,1)[0]);
  }
  if(pageCells.length<5) return null;
  pageCells.forEach(c=>used.add(key(c.x,c.y)));

  // reachability with door closed (for placing the button + checkpoint)
  const closedReach=(function(){ const blocked=new Set([key(door.x,door.y)]), seen={};
    seen[key(spawn.x,spawn.y)]=true; const q=[[spawn.x,spawn.y]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(seen[k]||!isFloor(nx,ny)||blocked.has(k)) continue; seen[k]=true; q.push([nx,ny]); } } return seen; })();

  // button = an unused dead-end reachable closed; mounted on the wall opposite its passage
  const btnCell=deadends.find(c=>!used.has(key(c.x,c.y))&&closedReach[key(c.x,c.y)]);
  if(!btnCell) return null; used.add(key(btnCell.x,btnCell.y));
  const bOpen=N4.find(([dx,dy])=>isFloor(btnCell.x+dx,btnCell.y+dy));
  const button={x:btnCell.x-bOpen[0], y:btnCell.y-bOpen[1], id:"b1", opens:["d1"]};

  // checkpoint = corridor cell nearest the half-way distance, reachable closed
  const maxD=Math.max(...Object.values(dist));
  let cp=null,bestDiff=1e9;
  for(const y of cellsY) for(const x of cellsX){ const k=key(x,y);
    if(used.has(k)||(x===spawn.x&&y===spawn.y)||!closedReach[k]) continue;
    const diff=Math.abs((dist[k]||0)-maxD*0.5); if(diff<bestDiff){bestDiff=diff; cp={x,y};} }
  if(!cp) return null;

  g[spawn.y][spawn.x]='S'; g[exit.y][exit.x]='E'; g[cp.y][cp.x]='C';
  let facing=1;
  if(isFloor(spawn.x+1,spawn.y)) facing=1; else if(isFloor(spawn.x,spawn.y+1)) facing=2;
  else if(isFloor(spawn.x-1,spawn.y)) facing=3; else facing=0;

  const pages=pageCells.map((c,i)=>({x:c.x,y:c.y,id:"p"+i,slot:i,frag:FRAGS[i]}));
  const level={ name:"ANLAGE 1 — KALIBRIERUNGSEBENE", spawnFacing:facing,
    grid:g.map(r=>r.join("")), doors:[door], buttons:[button], pages, coordTemplate:TEMPLATE };

  // ---- validate ----
  const errs=[];
  const bfs=open=>{ const bd=new Set(open?[]:[key(door.x,door.y)]), seen={};
    seen[key(spawn.x,spawn.y)]=true; const q=[[spawn.x,spawn.y]];
    while(q.length){ const [x,y]=q.shift(); for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(seen[k]||at(nx,ny)==='#'||bd.has(k)) continue; seen[k]=true; q.push([nx,ny]); } } return seen; };
  const closed=bfs(false), open=bfs(true);
  if(at(button.x,button.y)!=='#') errs.push("button not on wall");
  if(!N4.some(([dx,dy])=>at(button.x+dx,button.y+dy)!=='#'&&!(button.x+dx===door.x&&button.y+dy===door.y)&&closed[key(button.x+dx,button.y+dy)])) errs.push("button unreachable closed");
  pages.forEach(p=>{ if(!open[key(p.x,p.y)]) errs.push("page "+p.id+" unreachable"); });
  if(!open[key(exit.x,exit.y)]) errs.push("exit unreachable open");
  if(closed[key(exit.x,exit.y)]) errs.push("exit not gated by door");
  if(!closed[key(cp.x,cp.y)]) errs.push("checkpoint unreachable closed");
  if(errs.length) return null;

  return { level, pathLen:dist[key(exit.x,exit.y)]||0, deadends:deadends.length, seed };
}

let result=null;
for(let seed=START_SEED; seed<START_SEED+1000; seed++){ const r=build(seed); if(r){ result=r; break; } }
if(!result){ console.error("no solvable maze found — try different W/H or START_SEED"); process.exit(1); }

const L=result.level;
const enc=new TextEncoder(),dec=new TextDecoder(),kb=enc.encode(KEY);
const xorB=b=>{const o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b[i]^kb[i%kb.length];return o;};
const json=JSON.stringify(L);
const blob=Buffer.from(xorB(enc.encode(json))).toString("base64");
if(dec.decode(xorB(Uint8Array.from(Buffer.from(blob,"base64"))))!==json){ console.error("round-trip failed"); process.exit(1); }

let i=0; const coords=TEMPLATE.replace(/\{\}/g,()=>FRAGS.join("")[i++]);
console.log(`Validation: OK  |  seed ${result.seed}  |  ${W}x${H}  |  spawn->exit path ${result.pathLen}  |  dead-ends ${result.deadends}`);
console.log("Assembled coordinates preview:", coords);
console.log("\nMaze preview (dev only):");
console.log(L.grid.join("\n"));
console.log("\nPaste into index.html (var LEVEL_BLOB):\n");
const parts=[]; for(let p=0;p<blob.length;p+=74) parts.push('      "'+blob.slice(p,p+74)+'"');
console.log("    var LEVEL_BLOB =\n"+parts.join(" +\n")+";");
