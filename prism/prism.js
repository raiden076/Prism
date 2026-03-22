#!/usr/bin/env node
/**
 * PRISM Android Development Tool
 * Cross-platform setup and run script for Windows & Linux
 * 
 * Usage:
 *   ./prism.js setup    - Setup Android environment
 *   ./prism.js dev      - Run in development mode
 *   ./prism.js build    - Build APK
 *   ./prism.js doctor   - Check environment
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';
const PRISM_DIR = __dirname;
const TAURI_DIR = path.join(PRISM_DIR, 'src-tauri');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  console.error(`${colors.red}ERROR: ${msg}${colors.reset}`);
}

function success(msg) {
  log(`✓ ${msg}`, 'green');
}

function warn(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

function info(msg) {
  log(`ℹ ${msg}`, 'cyan');
}

function run(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: IS_WINDOWS,
      cwd: PRISM_DIR,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

function checkCommand(cmd) {
  try {
    execSync(IS_WINDOWS ? `where ${cmd}` : `which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getAndroidSdk() {
  const possiblePaths = IS_WINDOWS ? [
    'C:\\Android\\Sdk',
    `${process.env.USERPROFILE}\\AppData\\Local\\Android\\Sdk`,
    `${process.env.LOCALAPPDATA}\\Android\\Sdk`
  ] : [
    `${process.env.HOME}/Android/Sdk`,
    '/usr/lib/android-sdk',
    '/opt/android-sdk'
  ];
  
  for (const sdkPath of possiblePaths) {
    if (fs.existsSync(sdkPath)) {
      return sdkPath;
    }
  }
  return null;
}

// Commands
async function doctor() {
  log('\n=== PRISM Environment Check ===\n', 'blue');
  
  const checks = [
    { name: 'bun', cmd: 'bun' },
    { name: 'Node.js', cmd: 'node' },
    { name: 'Rust/Cargo', cmd: 'cargo' }
  ];
  
  let allGood = true;
  
  for (const check of checks) {
    if (checkCommand(check.cmd)) {
      success(`${check.name} found`);
    } else {
      error(`${check.name} not found`);
      allGood = false;
    }
  }
  
  // Check Android SDK
  const sdk = getAndroidSdk();
  if (sdk) {
    success(`Android SDK: ${sdk}`);
    process.env.ANDROID_HOME = sdk;
    process.env.ANDROID_SDK = sdk;
  } else {
    error('Android SDK not found');
    info(IS_WINDOWS 
      ? 'Install Android Studio from https://developer.android.com/studio'
      : 'Install Android SDK: sudo apt install android-sdk'
    );
    allGood = false;
  }
  
  // Check ADB
  if (checkCommand('adb')) {
    success('ADB found');
  } else {
    warn('ADB not in PATH');
  }
  
  // Check device
  try {
    const devices = execSync('adb devices', { encoding: 'utf8' });
    if (devices.includes('device') && !devices.includes('List of devices attached')) {
      const lines = devices.split('\n').filter(l => l.includes('device') && !l.includes('List'));
      success(`Device connected: ${lines.length}`);
    } else {
      warn('No device connected');
    }
  } catch {
    warn('Cannot check devices');
  }
  
  // Check if Android project initialized
  if (fs.existsSync(path.join(TAURI_DIR, 'gen/android'))) {
    success('Android project initialized');
  } else {
    warn('Android project not initialized (run: ./prism.js setup)');
  }
  
  log('\n' + (allGood ? '✓ Ready to go!' : '✗ Fix issues above'), allGood ? 'green' : 'red');
  log('');
}

async function setup() {
  log('\n=== Setting up PRISM Android ===\n', 'blue');
  
  // Check prerequisites
  if (!checkCommand('bun')) {
    error('bun not found. Install from https://bun.sh');
    process.exit(1);
  }
  
  if (!checkCommand('cargo')) {
    error('Rust not found. Install from https://rustup.rs');
    process.exit(1);
  }
  
  // Setup Android SDK
  const sdk = getAndroidSdk();
  if (!sdk) {
    error('Android SDK not found');
    info(IS_WINDOWS 
      ? '1. Download Android Studio: https://developer.android.com/studio'
      : '1. Install Android SDK: sudo apt install android-sdk'
    );
    info('2. Run this setup again');
    process.exit(1);
  }
  
  process.env.ANDROID_HOME = sdk;
  process.env.ANDROID_SDK = sdk;
  
  // Add to PATH
  const platformTools = path.join(sdk, 'platform-tools');
  process.env.PATH = `${platformTools}${IS_WINDOWS ? ';' : ':'}${process.env.PATH}`;
  
  success(`Android SDK: ${sdk}`);
  
  // Install dependencies
  info('Installing npm dependencies...');
  await run('bun', ['install']);
  
  // Add Rust Android targets
  info('Adding Rust Android targets...');
  const targets = [
    'aarch64-linux-android',
    'armv7-linux-androideabi',
    'i686-linux-android',
    'x86_64-linux-android'
  ];
  
  for (const target of targets) {
    try {
      execSync(`rustup target add ${target}`, { stdio: 'inherit' });
    } catch (e) {
      warn(`Failed to add target: ${target}`);
    }
  }
  
  // Initialize Android project if needed
  if (!fs.existsSync(path.join(TAURI_DIR, 'gen/android'))) {
    info('Initializing Android project...');
    await run('bun', ['run', 'tauri', 'android', 'init']);
  } else {
    success('Android project already initialized');
  }
  
  log('\n✓ Setup complete!', 'green');
  log('Run: ./prism.js dev\n');
}

async function dev() {
  log('\n=== Starting PRISM Android ===\n', 'blue');
  
  // Setup environment
  const sdk = getAndroidSdk();
  if (sdk) {
    process.env.ANDROID_HOME = sdk;
    process.env.ANDROID_SDK = sdk;
    process.env.PATH = `${path.join(sdk, 'platform-tools')}${IS_WINDOWS ? ';' : ':'}${process.env.PATH}`;
  }
  
  // Check if initialized
  if (!fs.existsSync(path.join(TAURI_DIR, 'gen/android'))) {
    error('Android project not initialized');
    info('Run: ./prism.js setup');
    process.exit(1);
  }
  
  info('Building and launching...');
  info('Press Ctrl+C to stop\n');
  
  await run('bun', ['run', 'tauri', 'android', 'dev']);
}

async function build() {
  log('\n=== Building PRISM APK ===\n', 'blue');
  
  const sdk = getAndroidSdk();
  if (sdk) {
    process.env.ANDROID_HOME = sdk;
    process.env.ANDROID_SDK = sdk;
  }
  
  info('Building release APK...');
  await run('bun', ['run', 'tauri', 'android', 'build']);
  
  const apkPath = path.join(TAURI_DIR, 'gen/android/app/build/outputs/apk/release');
  log(`\n✓ APK built: ${apkPath}`, 'green');
}

// Main
const command = process.argv[2];

switch (command) {
  case 'setup':
    setup().catch(e => { error(e.message); process.exit(1); });
    break;
  case 'dev':
  case 'run':
    dev().catch(e => { error(e.message); process.exit(1); });
    break;
  case 'build':
    build().catch(e => { error(e.message); process.exit(1); });
    break;
  case 'doctor':
  case 'check':
    doctor();
    break;
  default:
    log('PRISM Android Development Tool\n', 'blue');
    log('Usage:');
    log('  ./prism.js setup   - Setup Android environment');
    log('  ./prism.js dev     - Run in development mode');
    log('  ./prism.js build   - Build APK');
    log('  ./prism.js doctor  - Check environment\n');
    log('Examples:');
    log('  ./prism.js setup   # First time setup');
    log('  ./prism.js dev     # Start development\n');
}
