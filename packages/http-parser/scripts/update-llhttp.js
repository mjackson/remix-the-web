'use strict';

const { execSync } = require('node:child_process');
const { cpSync, mkdirSync, existsSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const DEPS_DIR = join(ROOT, 'deps', 'llhttp');
const LLHTTP_DIR = join(ROOT, 'src', 'llhttp');
const TMP_DIR = join(ROOT, '.tmp-llhttp');

// Clean up function
const cleanup = () => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
};

// Set up error handling
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/update-llhttp.js <tag>');
  console.error('Example: node scripts/update-llhttp.js v9.2.1');
  process.exit(1);
}

console.log(`Updating llhttp to ${tag}...`);

try {
  // Clean up any existing temp directory
  cleanup();

  // Clone llhttp repository
  console.log('Cloning llhttp repository...');
  execSync(`git clone --depth 1 --branch ${tag} https://github.com/nodejs/llhttp.git ${TMP_DIR}`, {
    stdio: 'inherit',
  });

  // Change to llhttp directory
  process.chdir(TMP_DIR);

  // Install dependencies
  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  // Build llhttp
  console.log('Building llhttp...');
  // Build the C files first
  execSync('npm run build', { stdio: 'inherit' });

  // Create deps directories if they don't exist
  mkdirSync(join(DEPS_DIR, 'src'), { recursive: true });
  mkdirSync(join(DEPS_DIR, 'include'), { recursive: true });

  // Copy JavaScript/TypeScript files
  console.log('Copying JavaScript/TypeScript files...');
  const jsFiles = [
    'constants.js',
    'constants.js.map',
    'constants.d.ts',
    'utils.js',
    'utils.js.map',
    'utils.d.ts',
  ];
  for (const file of jsFiles) {
    const srcPath = join(TMP_DIR, 'build', 'wasm', file);
    const destPath = join(LLHTTP_DIR, file);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath);
      console.log(`  Copied ${file}`);
    }
  }

  // Copy C source files
  console.log('Copying C source files...');
  cpSync(join(TMP_DIR, 'src', 'native', 'api.c'), join(DEPS_DIR, 'src', 'api.c'));
  cpSync(join(TMP_DIR, 'src', 'native', 'http.c'), join(DEPS_DIR, 'src', 'http.c'));
  cpSync(join(TMP_DIR, 'build', 'c', 'llhttp.c'), join(DEPS_DIR, 'src', 'llhttp.c'));
  console.log('  Copied C source files');

  // Copy header files
  console.log('Copying header files...');
  cpSync(join(TMP_DIR, 'src', 'native', 'api.h'), join(DEPS_DIR, 'include', 'api.h'));
  cpSync(join(TMP_DIR, 'build', 'llhttp.h'), join(DEPS_DIR, 'include', 'llhttp.h'));
  console.log('  Copied header files');

  // Change back to root directory
  process.chdir(ROOT);

  // Build WASM files
  console.log('Building WASM files...');
  execSync('node scripts/build-wasm.js --docker', { stdio: 'inherit' });

  console.log(`\nSuccessfully updated llhttp to ${tag}!`);
  console.log('\nNext steps:');
  console.log('1. Test the changes: npm test');
  console.log('2. Commit the changes');
} catch (error) {
  console.error('Error updating llhttp:', error.message);
  process.exit(1);
} finally {
  cleanup();
}
