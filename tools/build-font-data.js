const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fonts = {boyang:'NotoSerifSC-VF.ttf',huakang:'NotoSansSC-VF.ttf',xingkai:'NotoSerifSC-VF.ttf',tianying:'NotoSerifSC-VF.ttf',anjing:'NotoSerifSC-VF.ttf',xinwei:'NotoSerifSC-VF.ttf'};
const sans = fs.readFileSync(path.join(root,'assets','fonts','NotoSansSC-VF.ttf')).toString('base64');
const serif = fs.readFileSync(path.join(root,'assets','fonts','NotoSerifSC-VF.ttf')).toString('base64');
fs.writeFileSync(
  path.join(root, 'assets', 'fonts', 'font-data.js'),
  `window.TIMETABLE_FONT_DATA=(()=>{const s=${JSON.stringify(sans)},r=${JSON.stringify(serif)};return {boyang:r,huakang:s,xingkai:r,tianying:r,anjing:r,xinwei:r};})();\n`,
);
