import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('🚀 Starting AI Chatbot Fullstack Application...\n');

// Start Server
const serverProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'pipe',
  shell: true,
});

serverProcess.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[34m[server]\x1b[0m ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[server-err]\x1b[0m ${data}`);
});

// Start Client
const clientProcess = spawn(npmCmd, ['run', 'dev', '--', '--host'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'pipe',
  shell: true,
});

clientProcess.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[32m[client]\x1b[0m ${data}`);
});

clientProcess.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[33m[client-err]\x1b[0m ${data}`);
});

function cleanup() {
  console.log('\n🛑 Shutting down server and client processes...');
  try {
    serverProcess.kill();
  } catch {}
  try {
    clientProcess.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
