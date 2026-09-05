const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fonts = Object.fromEntries(['boyang','huakang','xingkai','tianying','anjing','xinwei'].map(key => [key, 'NotoSansSC-VF.ttf']));
const noto = fs.readFileSync(path.join(root, 'assets', 'fonts', 'NotoSansSC-VF.ttf')).toString('base64');
fs.writeFileSync(
  path.join(root, 'assets', 'fonts', 'font-data.js'),
  `window.TIMETABLE_FONT_DATA=(()=>{const n=${JSON.stringify(noto)};return {boyang:n,huakang:n,xingkai:n,tianying:n,anjing:n,xinwei:n};})();\n`,
);
