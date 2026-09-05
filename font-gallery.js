const fonts=[
 {name:'Noto Sans SC / 思源黑体',family:'NotoSansSC',style:'现代无衬线，清晰稳重',license:'SIL OFL 1.1',url:'https://github.com/notofonts/noto-cjk'},
 {name:'Noto Serif SC / 思源宋体',family:'NotoSerifSC',style:'宋体衬线，适合标题和节次',license:'SIL OFL 1.1',url:'https://github.com/notofonts/noto-cjk'},
 {name:'Source Han Sans / 思源黑体',family:'NotoSansSC',style:'适合正文、课程格子',license:'SIL OFL 1.1',url:'https://github.com/adobe-fonts/source-han-sans'},
 {name:'Source Han Serif / 思源宋体',family:'NotoSerifSC',style:'适合标题、时间和特殊行',license:'SIL OFL 1.1',url:'https://github.com/adobe-fonts/source-han-serif'},
 {name:'LXGW WenKai / 霞鹜文楷',family:'NotoSerifSC',style:'手写感强，接近楷体气质',license:'SIL OFL 1.1',url:'https://github.com/lxgw/LxgwWenKai'},
 {name:'LXGW WenKai Mono',family:'NotoSerifSC',style:'等宽手写风，适合时间列',license:'SIL OFL 1.1',url:'https://github.com/lxgw/LxgwWenKai'},
 {name:'ZCOOL XiaoWei / 站酷小薇',family:'NotoSerifSC',style:'装饰性较强，适合标题',license:'OFL 1.1',url:'https://fonts.google.com/specimen/ZCOOL+XiaoWei'},
 {name:'ZCOOL KuaiLe / 站酷快乐体',family:'NotoSansSC',style:'圆润活泼，适合强调课程',license:'OFL 1.1',url:'https://fonts.google.com/specimen/ZCOOL+KuaiLe'}
];
const gallery=document.querySelector('#gallery'),sample=document.querySelector('#sample'),weight=document.querySelector('#weight');
function render(){gallery.innerHTML=fonts.map(f=>`<article class="font-card"><h2>${f.name}</h2><span class="tag">${f.license}</span><span class="meta">${f.style}</span><div class="preview" style="font-family:${f.family};font-weight:${weight.value}">${sample.value}</div><div class="license">来源：<a href="${f.url}" target="_blank" rel="noreferrer">官方项目页面</a></div></article>`).join('')}
sample.addEventListener('input',render);weight.addEventListener('change',render);render();
