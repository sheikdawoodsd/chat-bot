import fs from 'fs';
import path from 'path';

const appPath = 'client/src/App.jsx';
const appContent = fs.readFileSync(appPath, 'utf8');

const importRegex = /import\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s+from\s+['"]([^'"]+)['"]/g;
let match;
let errors = 0;

while ((match = importRegex.exec(appContent)) !== null) {
  const namedImports = match[1];
  const defaultImport = match[2];
  const importPath = match[3];

  if (!importPath.startsWith('.')) continue;

  const basePath = path.resolve('client/src', importPath);
  let resolvedPath = '';
  for (const ext of ['', '.jsx', '.js', '/index.jsx', '/index.js']) {
    if (fs.existsSync(basePath + ext) && fs.statSync(basePath + ext).isFile()) {
      resolvedPath = basePath + ext;
      break;
    }
  }

  if (!resolvedPath) {
    console.error(`❌ File not found for import: ${importPath}`);
    errors++;
    continue;
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');

  if (defaultImport) {
    if (!fileContent.includes('export default')) {
      console.error(`❌ Missing default export '${defaultImport}' in ${resolvedPath}`);
      errors++;
    } else {
      console.log(`✅ Default export '${defaultImport}' verified in ${importPath}`);
    }
  }

  if (namedImports) {
    const names = namedImports.split(',').map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!fileContent.includes(name)) {
        console.error(`❌ Named export '${name}' might be missing in ${resolvedPath}`);
        errors++;
      } else {
        console.log(`✅ Named export '${name}' verified in ${importPath}`);
      }
    }
  }
}

if (errors === 0) {
  console.log('\n🎉 ALL APPS IMPORTS & EXPORTS VERIFIED SUCCESSFULLY!');
} else {
  console.error(`\nFound ${errors} import issues.`);
}

