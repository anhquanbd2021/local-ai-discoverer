#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRootDir = process.cwd(); 
const promptFile = path.join(__dirname, 'discovery-prompt.txt');
const testCasesFile = path.join(projectRootDir, 'TEST_CASES.md');

// 🛠️ DYNAMIC MODE DETECTION
const hasTestCasesFile = fs.existsSync(testCasesFile);

if (!hasTestCasesFile) {
  console.log('📝 [Local AI] TEST_CASES.md not found. Running in DISCOVERY MODE to map your legacy code...\n');
} else {
  console.log('🧪 [Local AI] TEST_CASES.md found! Running in TEST GENERATION & 100% COVERAGE MODE...\n');
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

console.log('🔍 Scanning workspace modules...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

targetDirectories.forEach((modulePath, index) => {
  console.log(`\n==================================================`);
  console.log(`📦 [${index + 1}/${targetDirectories.length}] Processing: ${modulePath}`);
  console.log(`==================================================`);

  let command = '';

  if (!hasTestCasesFile) {
    // DISCOVERY MODE COMMAND: Scan code and write out the markdown matrix file
    command = `aider --file "${modulePath}" --message-file "${promptFile}" --no-stream`;
  } else {
    // COVERAGE MODE COMMAND: Read existing markdown matrix, write tests, target 100% coverage
    command = `aider --read TEST_CASES.md --file "${modulePath}" --message-file "${promptFile}" --test-cmd "npm run test:coverage" --auto-test --no-stream`;
  }

  try {
    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    console.log(`\n✅ Finished step for: ${modulePath}`);
  } catch (error) {
    console.error(`❌ Interrupted processing block exception on folder "${modulePath}":`, error.message);
  }
});

console.log('\n🎉 Pipeline run complete!');
if (!hasTestCasesFile) {
  console.log('👉 Next Step: Review your brand new TEST_CASES.md, then run `npm run local-ai:discover` again to write the tests!');
}