#!/usr/bin/env node

/**
 * Local AI Codebase Discoverer & Test Coverage Automator
 * Powered by Ollama engine setups using Aider.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration constants
const projectRootDir = process.cwd();
const businessLogicFile = path.join(projectRootDir, 'BUSINESS_LOGIC.md');
const discoveryPrompt = path.join(__dirname, 'prompt-discovery.txt');
const coveragePrompt = path.join(__dirname, 'prompt-coverage.txt');
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
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Configure model options based on available Ollama models
const discoveryOptions = {
  model: process.env.DISCOVERY_MODEL || 'ollama_chat/deepseek-r1-gpu',
  editorModel: process.env.DISCOVERY_EDITOR_MODEL || 'ollama_chat/deepseek-r1-gpu'
};

const coverageOptions = {
  model: process.env.COVERAGE_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu',
  editorModel: process.env.COVERAGE_EDITOR_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu',
  testCmd: "npm run test:coverage",
  readFiles: ["BUSINESS_LOGIC.md"],
  messageFile: coveragePrompt
};

// Global settings for parallel processing and error handling
const CONCURRENCY_LIMIT = process.env.CONCURRENCY_LIMIT ? parseInt(process.env.CONCURRENCY_LIMIT) : 5;

/**
 * Recursively inspects the repository to find source code directories.
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

  const relativePath = path.relative(projectRootDir, dir);
  if (containsSourceFiles && relativePath !== "") {
    dirList.add(relativePath);
  }

  for (const subDir of subDirs) {
    scanForSourceDirectories(subDir, dirList);
  }

  return Array.from(dirList);
}

// Set Ollama API endpoint
process.env.OLLAMA_API_BASE = 'http://192.168.1.23:11434';

console.log('🔍 Indexing project structural layout map trees...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

if (targetDirectories.length === 0) {
  console.log('❌ No valid source code folders discovered. Exiting.');
  process.exit(0);
}

// Initialize logging with timestamp
function getCurrentTime() {
  return new Date().toLocaleTimeString();
}

console.log(`[${getCurrentTime()}] 🚀 Processing sequence initialized for ${targetDirectories.length} detected modules:`);

/**
 * Processes a module asynchronously with retries.
 */
async function processModuleWithRetries(modulePath, options, retries = 3) {
  try {
    const command = `aider 
      --model ${options.model}
      --editor-model ${options.editorModel}
      --file "${modulePath}"
      --message-file "${options.messageFile}"
      ${options.testCmd ? `--test-cmd "${options.testCmd}"` : ''}
      ${options.readFiles?.map(f => `--read ${f}`).join(' ') || ''}
      --auto-test
      --yes-always
      --auto-accept-architect
      --stream`;

    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    return `✅ Completed processing for module block: ${modulePath}`;
  } catch (error) {
    if (retries > 0 && error.message.includes('transient')) {
      console.log(`[${getCurrentTime()}] 🔄 Retrying ${modulePath}... Remaining attempts: ${retries}`);
      return processModuleWithRetries(modulePath, options, retries - 1);
    }
    throw new Error(`❌ Error processing "${modulePath}": ${error.message}`);
  }
}

/**
 * Processes modules in parallel with concurrency control.
 */
async function processQueue() {
  const tasks = targetDirectories.map((modulePath, index) => {
    return () => {
      console.log(`\n==================================================`);
      console.log(`[${getCurrentTime()}] 📦 [${index + 1}/${targetDirectories.length}] Processing folder domain: ${modulePath}`);
      console.log(`==================================================`);

      const options = hasBusinessSpecs ? coverageOptions : discoveryOptions;
      return processModuleWithRetries(modulePath, options);
    };
  });

  let completed = 0;
  while (tasks.length > 0) {
    const batch = tasks.splice(0, CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(batch.map(task => task()));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`${getCurrentTime()} ${result.value}`);
      } else {
        console.error(`${getCurrentTime()} ${result.reason.message}`);
      }

      completed++;
      console.log(`[${getCurrentTime()}] 🚀 Progress: ${completed}/${targetDirectories.length} modules processed`);
    });
  }
}

// Determine mode based on BUSINESS_LOGIC.md existence
const hasBusinessSpecs = fs.existsSync(businessLogicFile);
if (!hasBusinessSpecs) {
  console.log('📝 [MODE: DISCOVERY] BUSINESS_LOGIC.md not found.');
  console.log('🤖 Target Model: deepseek-r1-gpu -> Analyzing behavior & rendering diagrams...');
} else {
  console.log('🧪 [MODE: COVERAGE] BUSINESS_LOGIC.md found!');
  console.log('🤖 Target Model: qwen2.5-coder-14b-gpu -> Generating tests to hit 100% coverage...');
}

console.log(`[${getCurrentTime()}] Starting parallel processing with concurrency limit: ${CONCURRENCY_LIMIT}`);
processQueue();

console.log('\n🎉 [Local AI Pipeline Engine] Execution loop successfully finished processing!');
if (!hasBusinessSpecs) {
  console.log('👉 Next Step: Review your brand new BUSINESS_LOGIC.md file.');
  console.log('   Once satisfied, run this command again to trigger 100% test coverage generation via Qwen!');
}