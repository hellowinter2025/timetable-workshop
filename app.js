/* global PDFLib, fontkit */
'use strict';

const DAYS = ['星期一','星期二','星期三','星期四','星期五'];
const DEFAULT_ROWS = [
  { label:'早读', time:'7:00-7:30', subjects:['英语','语文','英语','语文','英语'] },
  { label:'一', time:'7:40-8:20', subjects:['英语','语文','生物','语文','物理'] },
  { label:'二', time:'8:35-9:15', subjects:['生物','数学','数学','数学','英语'] },
  { label:'课间操', time:'9:15-9:55', break:true },
  { label:'三', time:'9:55-10:35', subjects:['化学','英语','语文','语文','数学'] },
  { label:'眼保健操', time:'10:45-10:50', break:true },
  { label:'四', time:'10:50-11:30', subjects:['物理','化学','语文','英语','数学'] },
  { label:'午    休', time:'11:30-13:50', break:true, noon:true },
  { label:'五', time:'14:00-14:40', subjects:['语文','物理','体育','生物','英语'] },
  { label:'六', time:'14:50-15:30', subjects:['语文','艺术','化学','物理','体育'] },
  { label:'七', time:'15:40-16:20', subjects:['数学','英语','数学','英语','化学'] },
  { label:'八', time:'16:30-17:10', subjects:['数学','体活','物理','体活','生物'] },
  { label:'九', time:'17:20-18:00', subjects:['班会','生物','英语','化学','语文'] },
  { label:'晚饭', time:'18:00-19:40', break:true },
  { label:'晚读', time:'18:40-19:10', subjects:['语文','英语','语文','英语','语文'] },
  { label:'自习', time:'19:10-21:40', subjects:['化学','英语','物理','数学','生物'] }
];
const COLORS = {语文:'#ff0000',英语:'#7030a0',数学:'#92d050',物理:'#00b050',化学:'#00b0f0',生物:'#ff66cc',体育:'#0070c0',体活:'#8a58bd',艺术:'#9fca31',班会:'#f1d900',技术:'#00a9e8'};
const PALETTE = ['#374a67','#d06f3a','#3d8d83','#a45486','#6572c9','#9a782d'];
const MM = dpi => dpi / 25.4;
const STORAGE_KEY = 'timetable-workshop-v1';
const EXPORT_DPI = 450;
const TABLE_CROP_MM = { x:11.75, y:10.25, width:273.5, height:178.5 };
const SMALL_SAFE_MARGIN_MM = 1.2;

let state = loadState();
let history = [];
let mobileDay = 0;
let previewMode = 'large';
let renderTimer;
let toastTimer;

const editor = document.getElementById('scheduleEditor');
const settingsGrid = document.getElementById('settingsGrid');
const previewCanvas = document.getElementById('previewCanvas');
const paperFrame = document.getElementById('paperFrame');
const paperStage = document.getElementById('paperStage');

function cloneRows(rows){ return rows.map(r => ({...r, subjects:r.subjects ? [...r.subjects] : undefined})); }
function defaultState(){ return { rows:cloneRows(DEFAULT_ROWS), updatedAt:new Date().toISOString() }; }
function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.rows?.length === DEFAULT_ROWS.length) return saved;
  } catch (_) {}
  return defaultState();
}
function saveState(){
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById('saveState');
  el.lastChild.textContent = '已自动保存';
}
function snapshot(){
  history.push(JSON.stringify(state));
  if (history.length > 30) history.shift();
  document.getElementById('undoButton').disabled = false;
}
function subjectColor(name){
  const key = (name || '').trim();
  if (!key) return '#172033';
  if (COLORS[key]) return COLORS[key];
  let sum = 0; for (const char of key) sum = (sum * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[sum % PALETTE.length];
}

function buildEditor(){
  editor.innerHTML = '';
  editor.dataset.mobileDay = mobileDay;
  addDiv('editor-head','节次',editor);
  DAYS.forEach((day,i) => addDiv(`editor-head day-head day-${i}`,day,editor));
  state.rows.forEach((row,rowIndex) => {
    if (row.break) {
      const div = addDiv(`break-label${row.noon?' noon':''}`,row.label,editor);
      div.title = row.time;
      return;
    }
    addDiv('row-label',row.label,editor);
    row.subjects.forEach((subject,dayIndex) => {
      const cell = addDiv(`subject-cell day-${dayIndex}`,'',editor);
      const input = document.createElement('input');
      input.className = 'subject-input'; input.value = subject; input.maxLength = 8;
      input.placeholder = '填写科目'; input.dataset.row = rowIndex; input.dataset.day = dayIndex;
      input.style.setProperty('--subject-color',subjectColor(subject));
      input.addEventListener('focus',() => input.dataset.before = input.value);
      input.addEventListener('input',() => {
        if (!input.dataset.changed) { snapshot(); input.dataset.changed='1'; }
        state.rows[rowIndex].subjects[dayIndex] = input.value;
        input.style.setProperty('--subject-color',subjectColor(input.value));
        saveState(); scheduleRender();
      });
      input.addEventListener('blur',() => delete input.dataset.changed);
      cell.appendChild(input);
    });
  });
  buildSettings();
}
function addDiv(className,text,parent){ const div=document.createElement('div'); div.className=className; div.textContent=text; parent.appendChild(div); return div; }
function buildTabs(){
  const tabs=document.getElementById('dayTabs'); tabs.innerHTML='';
  DAYS.forEach((d,i) => { const b=document.createElement('button'); b.textContent=d.replace('星期','周'); b.className=i===mobileDay?'active':''; b.onclick=()=>{mobileDay=i;buildTabs();buildEditor();};tabs.appendChild(b); });
}
function buildSettings(){
  settingsGrid.innerHTML='';
  state.rows.forEach((row,i) => {
    const wrap=document.createElement('div'); wrap.className='setting-field';
    const label=document.createElement('label'); label.textContent=row.label.replace(/\s/g,'');
    const input=document.createElement('input'); input.value=row.time; input.setAttribute('aria-label',`${row.label}时间`);
    input.addEventListener('focus',()=>input.dataset.before=input.value);
    input.addEventListener('change',()=>{snapshot();state.rows[i].time=input.value;saveState();scheduleRender();});
    wrap.append(label,input);settingsGrid.appendChild(wrap);
  });
}

async function ensureFonts(){
  const specs=['24px BoyangOuti','24px HuakangWawa','24px STXingkai','20px Tianyingzhang','28px Anjingchen','22px STXinwei'];
  await Promise.all(specs.map(s => document.fonts.load(s,'课程表星期一语文数学时间')));
  await document.fonts.ready;
}
function fitFont(ctx,text,maxWidth,initialPx,minPx=8){
  let size=initialPx; while(size>minPx && ctx.measureText(text).width>maxWidth) size-=1; return size;
}
function setFont(ctx,sizePx,family,weight='400'){ ctx.font=`${weight} ${sizePx}px ${family}`; ctx.textAlign='center';ctx.textBaseline='middle'; }
function drawCentered(ctx,text,x,y,w,h,size,font,color,weight='400',options={}){
  setFont(ctx,size,font,weight); const fitted=fitFont(ctx,text,w*.92,size,size*.62); if(fitted!==size)setFont(ctx,fitted,font,weight);
  ctx.fillStyle=color;ctx.fillText(text,x+w/2,y+h/2+size*.02+(options.offsetY||0));
}
function drawGradientText(ctx,text,x,y,w,h,size,font,stops,weight='400',options={}){
  setFont(ctx,size,font,weight);
  const fitted=fitFont(ctx,text,w*.92,size,size*.62);
  if(fitted!==size)setFont(ctx,fitted,font,weight);
  const textWidth=ctx.measureText(text).width;
  const start=x+(w-textWidth)/2;
  const gradient=ctx.createLinearGradient(start,y,start+textWidth,y);
  stops.forEach(([position,color])=>gradient.addColorStop(position,color));
  ctx.fillStyle=gradient;
  const centerX=x+w/2,centerY=y+h/2+fitted*.02+(options.offsetY||0);
  if(options.skewX){ctx.save();ctx.translate(centerX,centerY);ctx.transform(1,0,options.skewX,1,0,0);ctx.fillText(text,0,0);ctx.restore();}
  else ctx.fillText(text,centerX,centerY);
}
function drawHeaderGradient(ctx,text,x,y,w,h,size,font,stops=[
  [0,'#ff0000'],[.51,'#ffff00'],[1,'#00b0f0']
]){
  drawGradientText(ctx,text,x,y,w,h,size,font,stops,'700');
}

function renderLarge(dpi=150){
  const canvas=document.createElement('canvas'); canvas.width=Math.round(297*MM(dpi));canvas.height=Math.round(210*MM(dpi));
  const ctx=canvas.getContext('2d',{alpha:false}); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const mm=MM(dpi), pt=dpi/72; const x0=12*mm,y0=10.5*mm; const colMm=[38,38,38,38,38,38,45]; const rowMm=[10,11,11,11,9,11,9,11,9,11,11,11,11,11,9,11,11];
  const xs=[x0];colMm.forEach(v=>xs.push(xs.at(-1)+v*mm)); const ys=[y0];rowMm.forEach(v=>ys.push(ys.at(-1)+v*mm));
  const line=Math.max(1,.5*pt);ctx.strokeStyle='#99ccff';ctx.lineWidth=line;ctx.lineCap='butt';
  // Horizontal rules.
  ys.forEach(y=>{ctx.beginPath();ctx.moveTo(xs[0],y);ctx.lineTo(xs[7],y);ctx.stroke();});
  // Outer and time-column verticals.
  [xs[0],xs[6],xs[7]].forEach(x=>{ctx.beginPath();ctx.moveTo(x,ys[0]);ctx.lineTo(x,ys.at(-1));ctx.stroke();});
  for(let c=1;c<6;c++){for(let r=0;r<rowMm.length;r++){const row=state.rows[r-1];const merged=r>0&&row?.break;if(!merged){ctx.beginPath();ctx.moveTo(xs[c],ys[r]);ctx.lineTo(xs[c],ys[r+1]);ctx.stroke();}}}
  // Top-left diagonal and miniature labels.
  ctx.beginPath();ctx.moveTo(xs[0],ys[0]);ctx.lineTo(xs[1],ys[1]);ctx.stroke();
  setFont(ctx,8.5*pt,'Tianyingzhang');ctx.fillStyle='#111';ctx.fillText('节次',xs[0]+27.5*mm,ys[0]+3.2*mm);ctx.fillText('日期',xs[0]+7*mm,ys[0]+7.2*mm);
  DAYS.forEach((day,i)=>drawHeaderGradient(ctx,day,xs[i+1],ys[0],colMm[i+1]*mm,rowMm[0]*mm,24*pt,'BoyangOuti'));
  const timeGradient=[[0,'#00b050'],[1,'#00b0f0']];
  drawHeaderGradient(ctx,'时间',xs[6],ys[0],colMm[6]*mm,rowMm[0]*mm,24*pt,'BoyangOuti',timeGradient);
  state.rows.forEach((row,i)=>{
    const r=i+1,y=ys[r],h=rowMm[r]*mm;
    if(row.break){
      const font=row.noon?'STXinwei':'Tianyingzhang';const size=(row.noon?22:20)*pt;const color=row.noon?'#ffc000':'#000';
      const lift=/^(课间操|午休|晚饭)$/.test(row.label.replace(/\s/g,''))?-.65*mm:0;
      drawCentered(ctx,row.label,xs[0],y,(xs[6]-xs[0]),h,size,font,color,'400',{offsetY:lift});
    }else{
      drawCentered(ctx,row.label,xs[0],y,colMm[0]*mm,h,24*pt,'STXingkai','#000');
      row.subjects.forEach((s,d)=>drawCentered(ctx,s,xs[d+1],y,colMm[d+1]*mm,h,24*pt,'HuakangWawa',subjectColor(s)));
    }
    drawGradientText(ctx,row.time,xs[6],y,colMm[6]*mm,h,28*pt,'Anjingchen',timeGradient,'700',{offsetY:-.65*mm,skewX:-.045});
  });
  const updated=new Date(state.updatedAt || Date.now()); const stamp=`修改于 ${updated.getFullYear()}-${String(updated.getMonth()+1).padStart(2,'0')}-${String(updated.getDate()).padStart(2,'0')}  ${String(updated.getHours()).padStart(2,'0')}:${String(updated.getMinutes()).padStart(2,'0')}:${String(updated.getSeconds()).padStart(2,'0')}`;
  setFont(ctx,10*pt,'STXinwei');ctx.textAlign='left';ctx.fillStyle='#ffe33d';ctx.fillText(stamp,8*mm,204.5*mm);
  return canvas;
}
function renderTableCrop(dpi=150){
  const mm=MM(dpi), big=renderLarge(dpi);
  const crop=document.createElement('canvas');
  crop.width=Math.round(TABLE_CROP_MM.width*mm);
  crop.height=Math.round(TABLE_CROP_MM.height*mm);
  const ctx=crop.getContext('2d',{alpha:false});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,crop.width,crop.height);
  ctx.drawImage(
    big,
    TABLE_CROP_MM.x*mm,TABLE_CROP_MM.y*mm,
    TABLE_CROP_MM.width*mm,TABLE_CROP_MM.height*mm,
    0,0,crop.width,crop.height
  );
  return crop;
}
function renderSheet(dpi=150){
  const canvas=document.createElement('canvas');canvas.width=Math.round(210*MM(dpi));canvas.height=Math.round(297*MM(dpi));
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const table=renderTableCrop(dpi),mm=MM(dpi),cellW=canvas.width/2,cellH=canvas.height/4;
  const drawW=cellW-2*SMALL_SAFE_MARGIN_MM*mm;
  const drawH=drawW*(TABLE_CROP_MM.height/TABLE_CROP_MM.width);
  for(let row=0;row<4;row++)for(let col=0;col<2;col++){
    const x=col*cellW+SMALL_SAFE_MARGIN_MM*mm;
    const y=row*cellH+(cellH-drawH)/2;
    ctx.drawImage(table,x,y,drawW,drawH);
  }
  return canvas;
}
function copyCanvas(source,target){target.width=source.width;target.height=source.height;target.getContext('2d').drawImage(source,0,0);}
async function renderPreview(){
  paperStage.classList.add('rendering');
  await ensureFonts();
  const canvas=previewMode==='large'?renderLarge(120):renderSheet(120);copyCanvas(canvas,previewCanvas);
  paperFrame.className=`paper-frame ${previewMode==='large'?'large':'sheet'}`;
  paperStage.classList.remove('rendering');
}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(renderPreview,90);}

function canvasBlob(canvas,type='image/png',quality=1){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图像生成失败')),type,quality));}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function fileDate(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;}
function importDocument(){return {format:'timetable-workshop',version:1,updatedAt:state.updatedAt,rows:cloneRows(state.rows)};}
function validateImport(data){
  if(data?.format&&data.format!=='timetable-workshop')throw new Error('格式标识不正确');
  if(data?.version&&data.version!==1)throw new Error('不支持的格式版本');
  if(!Array.isArray(data?.rows)||data.rows.length!==DEFAULT_ROWS.length)throw new Error(`必须包含 ${DEFAULT_ROWS.length} 个节次`);
  return data.rows.map((row,index)=>{
    if(typeof row.label!=='string'||typeof row.time!=='string')throw new Error(`第 ${index+1} 行缺少节次或时间`);
    if(row.break)return {label:row.label,time:row.time,break:true,...(row.noon?{noon:true}:{})};
    if(!Array.isArray(row.subjects)||row.subjects.length!==5||row.subjects.some(s=>typeof s!=='string'))throw new Error(`第 ${index+1} 行必须有 5 个科目`);
    return {label:row.label,time:row.time,subjects:[...row.subjects]};
  });
}
function loadScript(src,globalName){
  if(window[globalName])return Promise.resolve();
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`无法加载 ${src}`));document.head.appendChild(script);});
}
function base64Bytes(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function prepareVectorPdf(){
  await loadScript('vendor/fontkit.umd.min.js','fontkit');
  await loadScript('assets/fonts/font-data.js','TIMETABLE_FONT_DATA');
  const doc=await PDFLib.PDFDocument.create();doc.registerFontkit(fontkit);
  const data=window.TIMETABLE_FONT_DATA;
  const fonts={};
  for(const [key,value] of Object.entries(data))fonts[key]=await doc.embedFont(base64Bytes(value),{subset:true});
  return {doc,fonts};
}
const PT_PER_MM=72/25.4;
function hexRgb(hex){const v=parseInt(hex.slice(1),16);return {r:((v>>16)&255)/255,g:((v>>8)&255)/255,b:(v&255)/255};}
function mixRgb(a,b,t){return {r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t};}
function vectorTransform(page,destX=0,destTop=0,scale=1,cropX=0,cropTop=0){
  return {scale,x:mm=>destX+(mm-cropX)*PT_PER_MM*scale,y:mm=>page.getHeight()-destTop-(mm-cropTop)*PT_PER_MM*scale};
}
function fitPdfSize(font,text,maxWidth,size,minRatio=.62){let fitted=size;while(fitted>size*minRatio&&font.widthOfTextAtSize(text,fitted)>maxWidth)fitted-=.5;return fitted;}
function drawPdfText(page,font,text,left,top,width,height,size,color,scale=1,options={}){
  if(!text)return;const actual=fitPdfSize(font,text,width*.92,size*scale),tw=font.widthOfTextAtSize(text,actual),th=font.heightAtSize(actual,{descender:false});
  page.drawText(text,{x:left+(width-tw)/2,y:top-height/2-th/2+(options.offsetY||0)*scale,font,size:actual,color:PDFLib.rgb(...Object.values(hexRgb(color)))});
}
function gradientColor(stops,t){
  let i=1;while(i<stops.length&&t>stops[i][0])i++;const [p1,c1]=stops[Math.max(0,i-1)],[p2,c2]=stops[Math.min(i,stops.length-1)];
  return mixRgb(hexRgb(c1),hexRgb(c2),p2===p1?0:(t-p1)/(p2-p1));
}
function drawPdfGradientText(page,font,text,left,top,width,height,size,stops,scale=1,options={}){
  if(!text)return;const actual=fitPdfSize(font,text,width*.92,size*scale),tw=font.widthOfTextAtSize(text,actual),th=font.heightAtSize(actual,{descender:false});
  const x=left+(width-tw)/2,y=top-height/2-th/2+(options.offsetY||0)*scale;
  page.setFont(font);const fontKey=page.fontKey;
  page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.beginText(),PDFLib.setFontAndSize(fontKey,actual),PDFLib.setTextMatrix(1,0,options.skewX||0,1,x,y),PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Clip),PDFLib.showText(font.encodeText(text)),PDFLib.endText());
  const strips=48,stripW=tw/strips+.2;
  for(let i=0;i<strips;i++){const c=gradientColor(stops,(i+.5)/strips);page.pushOperators(PDFLib.setFillingRgbColor(c.r,c.g,c.b),PDFLib.rectangle(x+i*tw/strips,y-th*.15,stripW,th*1.3),PDFLib.fill());}
  page.pushOperators(PDFLib.popGraphicsState());
}
function drawVectorTable(page,fonts,transform,includeFooter){
  const t=transform,sc=t.scale,col=[38,38,38,38,38,38,45],rows=[10,11,11,11,9,11,9,11,9,11,11,11,11,11,9,11,11];
  const xs=[12];col.forEach(v=>xs.push(xs.at(-1)+v));const ys=[10.5];rows.forEach(v=>ys.push(ys.at(-1)+v));
  const line=(x1,y1,x2,y2)=>page.drawLine({start:{x:t.x(x1),y:t.y(y1)},end:{x:t.x(x2),y:t.y(y2)},thickness:.5*sc,color:PDFLib.rgb(.6,.8,1)});
  ys.forEach(y=>line(xs[0],y,xs[7],y));[xs[0],xs[6],xs[7]].forEach(x=>line(x,ys[0],x,ys.at(-1)));
  for(let c=1;c<6;c++)for(let r=0;r<rows.length;r++){const merged=r>0&&state.rows[r-1]?.break;if(!merged)line(xs[c],ys[r],xs[c],ys[r+1]);}
  line(xs[0],ys[0],xs[1],ys[1]);
  const box=(x,y,w,h)=>({left:t.x(x),top:t.y(y),width:w*PT_PER_MM*sc,height:h*PT_PER_MM*sc});
  let b=box(12,10.5,38,10);drawPdfText(page,fonts.tianying,'节次',t.x(34.5),b.top,10*PT_PER_MM*sc,b.height*.6,8.5,'#111111',sc);drawPdfText(page,fonts.tianying,'日期',b.left,b.top-b.height*.35,b.width*.52,b.height*.65,8.5,'#111111',sc);
  const weekStops=[[0,'#ff0000'],[.51,'#ffff00'],[1,'#00b0f0']],timeStops=[[0,'#00b050'],[1,'#00b0f0']];
  DAYS.forEach((day,i)=>{b=box(xs[i+1],ys[0],col[i+1],rows[0]);drawPdfGradientText(page,fonts.boyang,day,b.left,b.top,b.width,b.height,24,weekStops,sc);});
  b=box(xs[6],ys[0],col[6],rows[0]);drawPdfGradientText(page,fonts.boyang,'时间',b.left,b.top,b.width,b.height,24,timeStops,sc);
  state.rows.forEach((row,i)=>{const r=i+1;b=box(xs[0],ys[r],row.break?xs[6]-xs[0]:col[0],rows[r]);
    if(row.break){const lift=/^(课间操|午休|晚饭)$/.test(row.label.replace(/\s/g,''))?.65*PT_PER_MM:0;drawPdfText(page,row.noon?fonts.xinwei:fonts.tianying,row.label,b.left,b.top,b.width,b.height,row.noon?22:20,row.noon?'#ffc000':'#000000',sc,{offsetY:lift});}
    else{drawPdfText(page,fonts.xingkai,row.label,b.left,b.top,b.width,b.height,24,'#000000',sc);row.subjects.forEach((s,d)=>{const sb=box(xs[d+1],ys[r],col[d+1],rows[r]);drawPdfText(page,fonts.huakang,s,sb.left,sb.top,sb.width,sb.height,24,subjectColor(s),sc);});}
    const tb=box(xs[6],ys[r],col[6],rows[r]);drawPdfGradientText(page,fonts.anjing,row.time,tb.left,tb.top,tb.width,tb.height,28,timeStops,sc,{offsetY:.65*PT_PER_MM,skewX:-.045});
  });
  if(includeFooter){const updated=new Date(state.updatedAt||Date.now()),stamp=`修改于${updated.getFullYear()}-${String(updated.getMonth()+1).padStart(2,'0')}-${String(updated.getDate()).padStart(2,'0')}  ${String(updated.getHours()).padStart(2,'0')}:${String(updated.getMinutes()).padStart(2,'0')}:${String(updated.getSeconds()).padStart(2,'0')}`;page.drawText(stamp,{x:t.x(8),y:t.y(204.5)-5*sc,font:fonts.xinwei,size:10*sc,color:PDFLib.rgb(1,.89,.24)});}
}
async function exportPng(sheet){
  busy(sheet?'sheetPngButton':'largePngButton',true);
  try{await ensureFonts();const canvas=sheet?renderSheet(EXPORT_DPI):renderLarge(EXPORT_DPI);const blob=await canvasBlob(canvas);downloadBlob(blob,`课程表-${sheet?'8联小版':'A4大版'}-${fileDate()}.png`);showToast('450 DPI 超清 PNG 已生成');}
  finally{busy(sheet?'sheetPngButton':'largePngButton',false);}
}
async function createVectorPdf(sheet){
    const {doc,fonts}=await prepareVectorPdf();
    if(sheet){
      const W=595.276,H=841.89,page=doc.addPage([W,H]),cellW=W/2,cellH=H/4;
      const margin=SMALL_SAFE_MARGIN_MM*72/25.4,drawW=cellW-2*margin;
      const drawH=drawW*(TABLE_CROP_MM.height/TABLE_CROP_MM.width);
      const scale=drawW/(TABLE_CROP_MM.width*PT_PER_MM);
      for(let r=0;r<4;r++)for(let c=0;c<2;c++){const x=c*cellW+margin,top=r*cellH+(cellH-drawH)/2;drawVectorTable(page,fonts,vectorTransform(page,x,top,scale,TABLE_CROP_MM.x,TABLE_CROP_MM.y),false);}
    }else{
      const page=doc.addPage([841.89,595.276]);drawVectorTable(page,fonts,vectorTransform(page),true);
    }
    doc.setTitle(sheet?'课程表 8联小版':'课程表 A4大版');doc.setCreator('课程表排版工坊');
    return doc.save({useObjectStreams:true});
}
async function exportPdf(sheet){
  const id=sheet?'sheetPdfButton':'largePdfButton';busy(id,true);
  try{
    const out=await createVectorPdf(sheet);downloadBlob(new Blob([out],{type:'application/pdf'}),`课程表-${sheet?'8联小版':'A4大版'}-${fileDate()}.pdf`);showToast('真正矢量 PDF 已生成，可以直接打印');
  }finally{busy(id,false);}
}
function busy(id,on){const b=document.getElementById(id);b.disabled=on;b.style.opacity=on?'.62':'';b.style.cursor=on?'wait':'';}
function showToast(text){const t=document.getElementById('toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300);}

document.querySelectorAll('.view-switch button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.view-switch button').forEach(x=>x.classList.toggle('active',x===b));previewMode=b.dataset.view;renderPreview();}));
document.getElementById('undoButton').addEventListener('click',()=>{if(!history.length)return;state=JSON.parse(history.pop());saveState();buildEditor();scheduleRender();document.getElementById('undoButton').disabled=!history.length;});
document.getElementById('clearButton').addEventListener('click',()=>{snapshot();state.rows.forEach(r=>{if(r.subjects)r.subjects.fill('');});saveState();buildEditor();scheduleRender();});
document.getElementById('resetButton').addEventListener('click',()=>{snapshot();state=defaultState();saveState();buildEditor();scheduleRender();showToast('已恢复 Word 中的示例课程');});
document.getElementById('largePdfButton').addEventListener('click',()=>exportPdf(false));
document.getElementById('sheetPdfButton').addEventListener('click',()=>exportPdf(true));
document.getElementById('largePngButton').addEventListener('click',()=>exportPng(false));
document.getElementById('sheetPngButton').addEventListener('click',()=>exportPng(true));
document.getElementById('exportDataButton').addEventListener('click',()=>downloadBlob(new Blob([JSON.stringify(importDocument(),null,2)],{type:'application/json'}),`课程表填写备份-${fileDate()}.json`));
document.getElementById('importDataInput').addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text()),rows=validateImport(data);snapshot();state={rows,updatedAt:data.updatedAt||new Date().toISOString()};saveState();buildEditor();scheduleRender();showToast('标准课表已成功导入');}catch(error){showToast(error.message||'无法读取这个课表文件');}e.target.value='';});

buildTabs();buildEditor();document.getElementById('undoButton').disabled=true;renderPreview();
