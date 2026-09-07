import os from 'node:os';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const requestedPort = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : 3000;

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
          isWifi: name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wireless'),
        });
      }
    }
  }

  addresses.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  return addresses;
}

async function startLocalServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   REMIX 3D STUDIO - LOCAL DEVELOPMENT SERVER');
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[90m%s\x1b[0m', 'Starting Vite local server...\n');

  try {
    const server = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: requestedPort,
        strictPort: false,
        cors: true,
      },
    });

    await server.listen();

    const address = server.httpServer?.address();
    const actualPort = (typeof address === 'object' && address?.port) || server.config.server.port || requestedPort;
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';

    console.log('\x1b[1m\x1b[32m%s\x1b[0m', 'Local server is live and ready:');
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    console.log(`  ➜ Local:   \x1b[36mhttp://localhost:${actualPort}/\x1b[0m`);
    console.log(`  ➜ Network: \x1b[36mhttp://${primaryIp}:${actualPort}/\x1b[0m`);
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    console.log('\x1b[90m%s\x1b[0m', 'Press Ctrl+C to stop the server.');

    // Keep process alive indefinitely
    await new Promise(() => {});
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to start local server:', err);
    process.exit(1);
  }
}

startLocalServer();
