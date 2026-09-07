import os from 'node:os';
import { createServer } from 'vite';
import qrcodeTerminal from 'qrcode-terminal';

const requestedPort = 3001;

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

async function startFullScreenServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   SKETCHBOOK V16 - FULL SITE SERVER (PORT 3001)');
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[90m%s\x1b[0m', 'Initializing Vite development server for full site view...\n');

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
    const mobileUrl = `http://${primaryIp}:${actualPort}/?fullscreen=true`;
    const localUrl = `http://localhost:${actualPort}/?fullscreen=true`;

    console.log('\x1b[1m\x1b[34m%s\x1b[0m', '📱 SCAN THIS QR CODE FOR FULL SITE:');
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    qrcodeTerminal.generate(mobileUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');

    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '🚀 FULL SITE SERVER RUNNING:');
    console.log(`  \x1b[33m➜  Local URL:\x1b[0m     \x1b[1m\x1b[36m${localUrl}\x1b[0m`);
    console.log(`  \x1b[33m➜  Network URL:\x1b[0m   \x1b[36m${mobileUrl}\x1b[0m`);

    const handleShutdown = async () => {
      console.log('\nShutting down full site server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('Failed to start full site server:', error);
    process.exit(1);
  }
}

startFullScreenServer();
