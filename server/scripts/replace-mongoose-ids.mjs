import fs from 'fs';
import path from 'path';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const root = new URL('.', import.meta.url);
const srcDir = path.join(path.dirname(path.dirname(root.pathname.replace(/^\/([A-Za-z]:)/, '$1'))), 'src');
// Fix for Windows file URL
const serverSrc = path.resolve('src');

const files = walk(serverSrc);
let changed = 0;

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('mongoose')) continue;
  const orig = c;

  c = c.replace(/mongoose\.isValidObjectId\(/g, 'isValidId(');
  c = c.replace(/mongoose\.Types\.ObjectId\.isValid\(/g, 'isValidId(');
  c = c.replace(/new mongoose\.Types\.ObjectId\(([^)]+)\)/g, 'String($1)');

  const withoutImport = c.replace(/import mongoose from ['"]mongoose['"];\r?\n?/g, '');
  if (!/mongoose\./.test(withoutImport)) {
    c = withoutImport;
  }

  if (c.includes('isValidId(') && !/from ['"].*ids\.js['"]/.test(c)) {
    const norm = file.replace(/\\/g, '/');
    let imp = "import { isValidId } from '../utils/ids.js';\n";
    if (norm.includes('/utils/')) imp = "import { isValidId } from './ids.js';\n";
    if (norm.includes('/services/tracking/')) imp = "import { isValidId } from '../../utils/ids.js';\n";
    c = imp + c;
  }

  if (c !== orig) {
    fs.writeFileSync(file, c);
    changed += 1;
    console.log('updated', path.relative(process.cwd(), file));
  } else {
    console.log('unchanged mongoose file', path.relative(process.cwd(), file));
  }
}

console.log('changed', changed);
