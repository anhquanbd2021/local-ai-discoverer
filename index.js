#!/usr/bin/env node

/**
 * Local AI Codebase Discoverer & Test Coverage Automator
 * Powered by local Ollama engine setups using Aider.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRootDir = process.cwd(); 
// The master specification file that tracks business requirements and diagrams
const businessLogicFile = path.join(projectRootDir, 'BUSINESS_LOGIC.md');

// 🛠️ Dynamic Mode Auto-Detection
const hasBusinessSpecs = fs.existsSync(businessLogicFile);

const discoveryPrompt = path.join(__dirname, 'prompt-discovery.txt');
const coveragePrompt = path.join(__dirname, 'prompt-coverage.txt');

if (!hasBusinessSpecs) {
  console.log('📝 [MODE: DISCOVERY] BUSINESS_LOGIC.md not found.');
  console.log('🤖 Target Model: deepseek-r1:32b -> Analyzing behavior & rendering diagrams...\n');
} else {
  console.log('🧪 [MODE: COVERAGE] BUSINESS_LOGIC.md found!');
  console.log('🤖 Target Model: qwen2.5-coder:32b -> Generating tests to hit 100% coverage...\n');
}

// Global directories to explicitly ignore during the file scanner sequence
const BLACKLIST = new Set([
  'node_modules',
  '.next',
  '.git',
  'out',
  'build',
  'public',
  'coverage',
  '.github',
  'dist'
]);

// Source extensions we want to map context from
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/**
 * Recursively inspects the host repository tree to pinpoint 
 * deep leaf directories actively containing source code elements.
 */
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
      if (VALID_EXTENSIONS.has(ext)) {
        containsSourceFiles = true;
      }
    }
  }

  // Only append paths that are actual child directories, skipping the blank root string
  const relativePath = path.relative(projectRootDir, dir);
  if (containsSourceFiles && relativePath !== "") {
    dirList.add(relativePath);
  }

  for (const subDir of subDirs) {
    scanForSourceDirectories(subDir, dirList);
  }

  return Array.from(dirList);
}

// Standardize the host loop configuration address backup fallback
// Hardcode your local server IP address directly into the environment pool

process.env.OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434';

console.log('🔍 Indexing project structural layout map trees...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

if (targetDirectories.length === 0) {
  console.log('❌ No valid source code folders discovered. Exiting.');
  process.exit(0);
}

console.log(`🚀 Processing sequence initialized for ${targetDirectories.length} detected modules:`);
targetDirectories.forEach(d => console.log(`  - ${d}`));

// Run the sequential agent loop processing sequence across target blocks
targetDirectories.forEach((modulePath, index) => {
  console.log(`\n==================================================`);
  console.log(`📦 [${index + 1}/${targetDirectories.length}] Processing folder domain: ${modulePath}`);
  console.log(`==================================================`);

  let command = '';

  if (!hasBusinessSpecs) {
    // 🧠 DISCOVERY PHASE: Uses --yes-always to completely bypass user approval prompts
    command = `aider --model ollama_chat/deepseek-r1:32b --editor-model ollama_chat/deepseek-r1:32b --file "${modulePath}" --message-file "${discoveryPrompt}" --yes-always --auto-accept-architect --no-stream`;
  } else {
    // 💻 COVERAGE PHASE: Standardizes flags across test runner execution phases
    command = `aider --model ollama_chat/qwen2.5-coder:32b --editor-model ollama_chat/qwen2.5-coder:32b --read BUSINESS_LOGIC.md --file "${modulePath}" --message-file "${coveragePrompt}" --test-cmd "npm run test:coverage" --auto-test --yes-always --auto-accept-architect --no-stream`;
  }

  try {
    // Execute command synchronously and pipe standard I/O into your active terminal window
    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    console.log(`\n✅ Section complete for module block: ${modulePath}`);
  } catch (error) {
    console.error(`❌ Interrupted processing context exception on folder "${modulePath}":`, error.message);
  }
});

console.log('\n🎉 [Local AI Pipeline Engine] Execution loop successfully finished processing!');
if (!hasBusinessSpecs) {
  console.log('👉 Next Step: Review your brand new BUSINESS_LOGIC.md file.');
  console.log('   Once satisfied, run this command again to trigger 100% test coverage generation via Qwen!');
}