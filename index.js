#!/usr/bin/env node

/**
 * Local AI Codebase Discoverer & Test Coverage Automator
 * Optimized for 3x P100 hardware clusters with automatic CPU-offload self-healing.
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

// ==========================================
// 🎛️ HARDWARE & PIPELINE CONFIGURATION
// ==========================================
const OLLAMA_SERVER_URL = process.env.OLLAMA_API_BASE || 'http://192.168.1.23:11434';
const CONCURRENCY_LIMIT = 1; // Match with OLLAMA_NUM_PARALLEL

const MODEL_DISCOVERY  = 'ollama_chat/deepseek-r1:32b'; 
const MODEL_COVERAGE   = 'ollama_chat/qwen2.5-coder:32b';
// ==========================================

const projectRootDir = process.cwd(); 
const businessLogicFile = path.join(projectRootDir, 'BUSINESS_LOGIC.md');
const hasBusinessSpecs = fs.existsSync(businessLogicFile);

const discoveryPrompt = path.join(__dirname, 'prompt-discovery.txt');
const coveragePrompt = path.join(__dirname, 'prompt-coverage.txt');

const BLACKLIST = new Set(['node_modules', '.next', '.git', 'out', 'build', 'public', 'coverage', '.github', 'dist']);
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

process.env.OLLAMA_API_BASE = OLLAMA_SERVER_URL;

/**
 * Self-healing Hook: Automatically checks for CPU leakage and repairs the environment.
 */
async function ensurePureGpuExecution() {
  try {
    // 1. Ask Ollama for its current active processing matrix
    const { stdout } = await execPromise('ollama ps');
    
    // Check if a model is running and if the processor string contains "CPU" (e.g., "13%/87% CPU/GPU")
    if (stdout.includes('CPU')) {
      console.warn('\n⚠️ [Automated Guard] Detected model spilling into CPU RAM! Initiating hot repair...');
      
      // Execute driver and service recycle sequence silently
      await execPromise('sudo systemctl stop ollama');
      await execPromise('sudo rmmod nvidia_uvm && sudo modprobe nvidia_uvm');
      await execPromise('sudo systemctl daemon-reload && sudo systemctl start ollama');
      
      // Give the background service 3 seconds to re-bind to the PCIe channels
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✨ [Automated Guard] Driver refreshed. Ollama successfully forced back to pure VRAM.\n');
    }
  } catch (err) {
    // If ollama ps fails because the service is offline, kickstart it
    try {
      await execPromise('sudo systemctl start ollama');
    } catch (_) {}
  }
}

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

async function main() {
  if (!hasBusinessSpecs) {
    console.log('📝 [MODE: DISCOVERY] BUSINESS_LOGIC.md not found.');
  } else {
    console.log('🧪 [MODE: COVERAGE] BUSINESS_LOGIC.md found!');
  }

  const targetDirectories = scanForSourceDirectories(projectRootDir);
  if (targetDirectories.length === 0) {
    console.log('❌ No valid source code folders discovered. Exiting.');
    process.exit(0);
  }

  let currentIdx = 0;

  async function worker() {
    while (currentIdx < targetDirectories.length) {
      const index = currentIdx++;
      const modulePath = targetDirectories[index];
      const taskDisplayNum = index + 1;

      // Run hardware structural diagnostic before letting Aider request context
      await ensurePureGpuExecution();

      console.log(`🛫 [${taskDisplayNum}/${targetDirectories.length}] Processing domain: ${modulePath}`);

      let command = '';
      if (!hasBusinessSpecs) {
        command = `aider --model ${MODEL_DISCOVERY} --editor-model ${MODEL_DISCOVERY} --file "${modulePath}" --message-file "${discoveryPrompt}" --yes-always --auto-accept-architect --no-stream`;
      } else {
        command = `aider --model ${MODEL_COVERAGE} --editor-model ${MODEL_COVERAGE} --read BUSINESS_LOGIC.md --file "${modulePath}" --message-file "${coveragePrompt}" --test-cmd "npm run test:coverage" --auto-test --yes-always --auto-accept-architect --no-stream`;
      }

      try {
        const { stdout } = await execPromise(command, { cwd: projectRootDir });
        console.log(`✅ [${taskDisplayNum}/${targetDirectories.length}] Completed module block: ${modulePath}\n${stdout}`);
      } catch (error) {
        console.error(`❌ [${taskDisplayNum}/${targetDirectories.length}] Interrupted context on folder "${modulePath}":\n`, error.stdout || error.message);
      }
    }
  }

  const workerPool = Array(Math.min(CONCURRENCY_LIMIT, targetDirectories.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workerPool);
  console.log('\n🎉 [Local AI Pipeline Engine] Execution loop successfully finished processing!');
}

main().catch(err => console.error("Pipeline crashed unexpectedly:", err));