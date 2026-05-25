#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRootDir = process.cwd(); 
const testCasesFile = path.join(projectRootDir, 'TEST_CASES.md');

// Check mode setting
const hasTestCasesFile = fs.existsSync(testCasesFile);

// 🛠️ Dynamic file mapping based on mode
const discoveryPrompt = path.join(__dirname, 'prompt-discovery.txt');
const coveragePrompt = path.join(__dirname, 'prompt-coverage.txt');

if (!hasTestCasesFile) {
  console.log('📝 [MODE: DISCOVERY] TEST_CASES.md not found.');
  console.log('🤖 Target Model: deepseek-r1:32b -> Analyzing legacy behavior...\n');
} else {
  console.log('🧪 [MODE: COVERAGE] TEST_CASES.md found!');
  console.log('🤖 Target Model: qwen2.5-coder:32b -> Generating tests to hit 100% coverage...\n');
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

console.log('🔍 Indexing project directory tree maps...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

targetDirectories.forEach((modulePath, index) => {
  console.log(`\n==================================================`);
  console.log(`📦 [${index + 1}/${targetDirectories.length}] Processing folder: ${modulePath}`);
  console.log(`==================================================`);

let command = '';

  if (!hasTestCasesFile) {
    // 🧠 DISCOVERY MODE: Force both fields to use deepseek-r1:32b to avoid fallback switches
    command = `aider --model ollama_chat/deepseek-r1:32b --editor-model ollama_chat/deepseek-r1:32b --file "${modulePath}" --message-file "${discoveryPrompt}" --no-stream`;
  } else {
    // 💻 COVERAGE MODE: Force both fields to use your desired qwen2.5-coder version explicitly
    command = `aider --model ollama_chat/qwen2.5-coder:32b --editor-model ollama_chat/qwen2.5-coder:32b --read TEST_CASES.md --file "${modulePath}" --message-file "${coveragePrompt}" --test-cmd "npm run test:coverage" --auto-test --no-stream`;
  }

  try {
    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    console.log(`\n✅ Section complete for module: ${modulePath}`);
  } catch (error) {
    console.error(`❌ Interrupted execution block exception on folder "${modulePath}":`, error.message);
  }
});

console.log('\n🎉 Execution engine completed processing all project modules!');