#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// The tool runs wherever the developer invokes it from in their terminal
const projectRootDir = process.cwd(); 
const promptFile = path.join(__dirname, 'discovery-prompt.txt');

// Operational Exclusion rules
const BLACKLIST = new Set([
  'node_modules', '.next', '.git', 'out', 'build', 'public', 'coverage', '.github'
]);
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs']);

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

  if (containsSourceFiles) {
    dirList.add(path.relative(projectRootDir, dir));
  }

  for (const subDir of subDirs) {
    scanForSourceDirectories(subDir, dirList);
  }

  return Array.from(dirList);
}

// Force the baseline address fallback environment variable
process.env.OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434';

console.log('🔍 [Local AI Discoverer] Scanning target workspace map structure...');
const targetDirectories = scanForSourceDirectories(projectRootDir);

if (targetDirectories.length === 0) {
  console.log('❌ No valid code elements discovered. Shutting down pipeline.');
  process.exit(0);
}

console.log(`\n🚀 Discovered ${targetDirectories.length} interactive modules. Initializing sequential loop:`);
targetDirectories.forEach(d => console.log(`  - ${d}`));

targetDirectories.forEach((modulePath, index) => {
  console.log(`\n--------------------------------------------------`);
  console.log(`📦 [${index + 1}/${targetDirectories.length}] Processing module directory context: ${modulePath}`);
  console.log(`--------------------------------------------------`);

  const command = `aider --file "${modulePath}" --message-file "${promptFile}" --no-stream`;

  try {
    execSync(command, { cwd: projectRootDir, stdio: 'inherit' });
    console.log(`\n✅ Completed mapping append processing for: ${modulePath}`);
  } catch (error) {
    console.error(`❌ Interrupted processing block exception on folder "${modulePath}":`, error.message);
  }
});

console.log('\n🎉 Pipeline loop process terminal trace complete. Review the outputs inside TEST_CASES.md');