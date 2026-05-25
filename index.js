#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRootDir = process.cwd(); 
const promptFile = path.join(__dirname, 'discovery-prompt.txt');
const testCasesFile = path.join(projectRootDir, 'TEST_CASES.md');

// Ensure the blueprint document exists before booting the automated system loop
if (!fs.existsSync(testCasesFile)) {
  console.error('❌ Error: TEST_CASES.md not found in the root directory. Please generate it first.');
  process.exit(1);
}

const BLACKLIST = new Set(['node_modules', '.next', '.git', 'out', 'build', 'public', 'coverage', '.github']);
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function scanForSourceDirectories(dir, dirList = new Set()) {
  const files = fs.readdirSync(dir);
  let containsSourceFiles = false;
  const subDirs = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (BLACKLIST.has(file)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      subDirs.push(fullPath);
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (VALID_EXTENSIONS.has(ext)) containsSourceFiles = true;
    }
  }

  if (containsSourceFiles) {
    dirList.add(path.relative(projectRootDir, dir));
  }

  for (const subDir of subDirs) {
    scanForSourceDirectories(subDir, dirList);
  }

  return Array.from(dirList);
}

process.env.OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434';

console.log('🔍 [Local AI Test Runner] Scanning workspace maps for coverage targets...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

targetDirectories.forEach((modulePath, index) => {
  console.log(`\n==================================================`);
  console.log(`🧪 [${index + 1}/${targetDirectories.length}] Testing Module: ${modulePath}`);
  console.log(`==================================================`);

  // --read flags mount the file as read-only context (prevents the AI from corrupting your blueprint)
  // --test-cmd binds the code coverage reporter script to Aider's evaluation loop
  // --auto-test forces Aider to automatically re-run the script if coverage fails or errors out
  const command = `aider --read TEST_CASES.md --file "${modulePath}" --message-file "${promptFile}" --test-cmd "npm run test:coverage" --auto-test --no-stream`;

  try {
    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    console.log(`\n✅ Completed test generation & 100% coverage check for: ${modulePath}`);
  } catch (error) {
    console.error(`❌ Coverage execution loop interrupted on directory folder "${modulePath}":`, error.message);
  }
});

console.log('\n🎉 Test and coverage tracking loop completed across all codebase folders.');