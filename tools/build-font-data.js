const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fonts = {
  boyang: 'boyang-outi.ttf',
  huakang: 'huakang-wawa.ttf',
  xingkai: 'stxingkai.ttf',
  tianying: 'tianyingzhang-kaishu.ttf',
  anjing: 'anjingchen-xingshu.ttf',
  xinwei: 'stxinwei.ttf',
};
const encoded = Object.fromEntries(Object.entries(fonts).map(([key, file]) => [
  key,
  fs.readFileSync(path.join(root, 'assets', 'fonts', file)).toString('base64'),
]));
fs.writeFileSync(
  path.join(root, 'assets', 'fonts', 'font-data.js'),
  `window.TIMETABLE_FONT_DATA=${JSON.stringify(encoded)};\n`,
);
