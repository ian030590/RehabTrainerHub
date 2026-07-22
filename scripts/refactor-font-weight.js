const fs = require('fs');
const path = require('path');

const files = [
  'apps/rehabtrainerhub/app/globals.css',
  'apps/motortrainer/src/index.css',
  'apps/visiontrainer/src/index.css',
  'apps/visiontrainer/src/pages/training/hart-chart.css'
];

const variables = `
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-semibold-plus: 650;
  --fw-bold: 700;
  --fw-bold-plus: 750;
  --fw-extrabold: 800;
  --fw-extrabold-plus: 850;
  --fw-black: 900;`;

const weightMap = {
  '400': 'var(--fw-regular)',
  '500': 'var(--fw-medium)',
  '600': 'var(--fw-semibold)',
  '650': 'var(--fw-semibold-plus)',
  '700': 'var(--fw-bold)',
  '750': 'var(--fw-bold-plus)',
  '800': 'var(--fw-extrabold)',
  '850': 'var(--fw-extrabold-plus)',
  '900': 'var(--fw-black)'
};

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Insert variables into :root if not already there and if this file has a :root
  if (content.includes(':root {') && !content.includes('--fw-regular: 400;')) {
    content = content.replace(/:root\s*\{/, `:root {${variables}`);
  }

  // Replace hardcoded font weights
  // Match font-weight: <number>[ !important];
  const regex = /font-weight:\s*(\d+)(\s*!important)?\s*;/g;
  content = content.replace(regex, (match, weight, important) => {
    if (weightMap[weight]) {
      return 'font-weight: ' + weightMap[weight] + (important || '') + ';';
    }
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + file);
}
