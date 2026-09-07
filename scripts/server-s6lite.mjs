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

async function startS6LiteServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  SAMSUNG GALAXY TAB S6 LITE SERVER (1200 × 2000 PORTRAIT)');
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[90m%s\x1b[0m', 'Display: 10.4″ WUXGA+ (1200×2000 px) • 5:3 Aspect Ratio • S-Pen Stylus\n');

  try {
    const server = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: requestedPort,
        cors: true,
      },
    });

    await server.listen();

    const actualPort = server.config.server.port || requestedPort;
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';
    const mobileUrl = `http://${primaryIp}:${actualPort}/?device=s6lite`;
    const localUrl = `http://localhost:${actualPort}/?device=s6lite`;

    console.log('\x1b[1m\x1b[34m%s\x1b[0m', '📱 SCAN WITH GALAXY TAB S6 LITE OR PHONE:');
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    qrcodeTerminal.generate(mobileUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');

    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '🚀 S6 LITE SERVER RUNNING:');
    console.log(`  \x1b[33m➜  Local URL:\x1b[0m     \x1b[1m\x1b[36m${localUrl}\x1b[0m`);
    console.log(`  \x1b[33m➜  Network URL:\x1b[0m   \x1b[36m${mobileUrl}\x1b[0m`);
    console.log(`  \x1b[35m➜  Resolution:\x1b[0m    1200 x 2000 pixels (Portrait Mode)\n`);

    const handleShutdown = async () => {
      console.log('\nShutting down S6 Lite server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('Failed to start S6 Lite server:', error);
    process.exit(1);
  }
}

startS6LiteServer();
