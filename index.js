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
  model: process.env.DISCOVERY_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu',
  editorModel: process.env.DISCOVERY_EDITOR_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu'
};

const coverageOptions = {
  model: process.env.COVERAGE_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu',
  editorModel: process.env.COVERAGE_EDITOR_MODEL || 'ollama_chat/qwen2.5-coder-14b-gpu',
  testCmd: "npm run test:coverage",
  readFiles: ["BUSINESS_LOGIC.md"],
  messageFile: coveragePrompt
};

// Global settings for parallel processing and error handling
const CONCURRENCY_LIMIT = process.env.CONCURRENCY_LIMIT ? parseInt(process.env.CONCURRENCY_LIMIT) : 15;

/**
 * Recursively inspects the repository to find source code directories.
 */
function scanForSourceDirectories(dir, dirList = new Set()) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory() && !BLACKLIST.has(file)) {
      dirList.add(filePath.replace(projectRootDir + '\\', ''));
      scanForSourceDirectories(filePath, dirList);
    }
  }
  return Array.from(dirList);
}

/**
 * Main execution logic
 */
async function main() {
  const directories = scanForSourceDirectories(projectRootDir);
  if (directories.length === 0) {
    console.log('🛑 No valid directories found to process.');
    return;
  }

  // Determine mode based on BUSINESS_LOGIC.md existence
  const hasBusinessSpecs = fs.existsSync(businessLogicFile);
  
  // Set up processing options
  const processingOptions = hasBusinessSpecs ? coverageOptions : discoveryOptions;

  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Processing sequence initialized for ${directories.length} detected modules:`);
  if (hasBusinessSpecs) {
    console.log('🧪 [MODE: COVERAGE] BUSINESS_LOGIC.md found!');
    console.log(`🤖 Target Model: ${processingOptions.model} -> Generating tests to hit 100% coverage...`);
  } else {
    console.log('📝 [MODE: DISCOVERY] BUSINESS_LOGIC.md not found.');
    console.log('🤖 Target Model: ${processingOptions.model} -> Analyzing behavior & rendering diagrams...');
  }

  // Process in parallel
  await processQueue(directories, processingOptions);
}

/**
 * Processes modules in parallel with concurrency control.
 */
async function processQueue(directories, options) {
  const tasks = directories.map((modulePath, index) => {
    return () => {
      console.log(`\n==================================================`);
      console.log(`[${new Date().toLocaleTimeString()}] 📦 [${index + 1}/${directories.length}] Processing folder domain: ${modulePath}`);
      console.log(`==================================================`);

      return processModule(modulePath, options);
    };
  });

  let completed = 0;
  while (tasks.length > 0) {
    const batch = tasks.splice(0, CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(batch.map(task => task()));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`${new Date().toLocaleTimeString()} ${result.value}`);
      } else {
        console.error(`${new Date().toLocaleTimeString()} Error processing module: ${result.reason.message}`);
      }

      completed++;
      console.log(`[${new Date().toLocaleTimeString()}] 🚀 Progress: ${completed}/${directories.length} modules processed`);
    });
  }
}

/**
 * Processes a single module
 */
async function processModule(modulePath, options) {
  try {
    const command = `node ${path.join(__dirname, 'index.js')} --process-module '${modulePath}'`;
    execSync(command, { stdio: 'inherit' });
    return `[${new Date().toLocaleTimeString()}] ✅ Successfully processed: ${modulePath}`;
  } catch (error) {
    throw new Error(`Error processing module ${modulePath}: ${error.message}`);
  }
}

// Main execution
main();

console.log('\n🎉 [Local AI Pipeline Engine] Execution loop successfully finished processing!');
