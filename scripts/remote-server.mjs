import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import qrcodeTerminal from 'qrcode-terminal';

const requestedPort = 3000;

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
          isWifi:
            name.toLowerCase().includes('wi-fi') ||
            name.toLowerCase().includes('wlan') ||
            name.toLowerCase().includes('wireless'),
        });
      }
    }
  }

  addresses.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  return addresses;
}

function findCloudflaredPath() {
  const standardPaths = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ];
  for (const p of standardPaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'cloudflared';
}

function isPortActive(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'HEAD', timeout: 1500 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function startRemoteServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   PAPER ROCKETS 3D - REMOTE CELLULAR ACCESS SERVER');
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');

  const localIps = getLocalIpAddresses();
  const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';
  const localWifiUrl = `http://${primaryIp}:${requestedPort}`;
  const computerUrl = `http://localhost:${requestedPort}`;

  let server = null;
  const alreadyRunning = await isPortActive(requestedPort);

  if (alreadyRunning) {
    console.log('\x1b[32m✔ Detected active server on port ' + requestedPort + ' (reusing existing server)\x1b[0m');
  } else {
    console.log('\x1b[90mStarting local server on port ' + requestedPort + '...\x1b[0m');
    server = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: requestedPort,
        cors: true,
      },
    });
    await server.listen();
    console.log('\x1b[32m✔ Local server started successfully\x1b[0m');
  }

  console.log('\x1b[90mConnecting to Cloudflare secure tunnel network for cellular access...\x1b[0m\n');

  const cloudflaredExe = findCloudflaredPath();
  const tunnelProc = spawn(cloudflaredExe, ['tunnel', '--url', `http://localhost:${requestedPort}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let cellularUrl = null;

  // Keep process alive indefinitely
  const keepAliveTimer = setInterval(() => {}, 1000 * 60 * 60);

  tunnelProc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !cellularUrl) {
      cellularUrl = match[0];
      const previewText = `=============================================================
PAPER ROCKETS 3D - PREVIEW LINKS
=============================================================

1. On your phone (cellular / 4G / 5G / away from home):
   ${cellularUrl}

2. On your phone (at home on same Wi-Fi):
   ${localWifiUrl}

3. On this computer:
   ${computerUrl}

Port: ${requestedPort}

HOW TO RUN WHEN LEAVING HOME:
Double-click "start-remote-server.bat" in E:\\X\\AiStudio Workflow\\V19.
Keep the window open on your PC so the tunnel stays active while you are away.
=============================================================
`;
      try {
        fs.writeFileSync(path.resolve('./CELLULAR_PREVIEW_URL.txt'), previewText, 'utf8');
      } catch (_) {}
      printServerLinks(computerUrl, localWifiUrl, cellularUrl, requestedPort);
    }
  });

  tunnelProc.on('error', (err) => {
    console.warn('Could not launch cloudflared:', err.message);
    printServerLinks(computerUrl, localWifiUrl, null, requestedPort);
  });

  tunnelProc.on('exit', (code) => {
    console.log(`Cloudflare tunnel exited with code ${code}`);
    clearInterval(keepAliveTimer);
    process.exit(code || 0);
  });

  setTimeout(() => {
    if (!cellularUrl) {
      printServerLinks(computerUrl, localWifiUrl, null, requestedPort);
    }
  }, 8000);

  const handleShutdown = async () => {
    console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down remote cellular tunnel...');
    clearInterval(keepAliveTimer);
    try {
      tunnelProc.kill();
    } catch (_) {}
    if (server) {
      await server.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

function printServerLinks(computerUrl, localWifiUrl, cellularUrl, port) {
  console.log('\x1b[36m%s\x1b[0m', '-------------------------------------------------------------');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '🚀 SERVER IS RUNNING & REACHABLE EVERYWHERE:');
  console.log('\x1b[36m%s\x1b[0m', '-------------------------------------------------------------');
  console.log(`  \x1b[1mOn this computer:\x1b[0m                        \x1b[36m${computerUrl}\x1b[0m`);
  console.log(`  \x1b[1mOn your phone (same Wi-Fi):\x1b[0m              \x1b[33m${localWifiUrl}\x1b[0m`);
  if (cellularUrl) {
    console.log(`  \x1b[1m\x1b[35mOn your phone (cellular / away from home):\x1b[0m \x1b[1m\x1b[32m${cellularUrl}\x1b[0m`);
    console.log('\n\x1b[1m\x1b[34m%s\x1b[0m', '📱 SCAN THIS FOR CELLULAR ACCESS (WORKS ANYWHERE):');
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    qrcodeTerminal.generate(cellularUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
  } else {
    console.log('  \x1b[33mCellular Tunnel:\x1b[0m Establishing tunnel...');
  }
  console.log(`\nPort Number: ${port}`);
  console.log('\x1b[90m%s\x1b[0m', 'Keep this window open on your PC so you can access the site when away.\n');
}

startRemoteServer();
