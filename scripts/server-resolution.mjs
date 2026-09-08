import os from 'node:os';
import { createServer } from 'vite';
import qrcodeTerminal from 'qrcode-terminal';

const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const requestedPort = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : 3003;

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

async function startResolutionServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '================================================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  REMIX 3D STUDIO - RESOLUTION TESTING SERVER (S25 ULTRA & S6 LITE)');
  console.log('\x1b[36m%s\x1b[0m', '================================================================================\n');

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

    const actualPort = server.config.server.port || requestedPort;
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';

    const s25LocalUrl = `http://localhost:${actualPort}/?device=s25ultra`;
    const s25NetworkUrl = `http://${primaryIp}:${actualPort}/?device=s25ultra`;

    const s6LocalUrl = `http://localhost:${actualPort}/?device=s6lite`;
    const s6NetworkUrl = `http://${primaryIp}:${actualPort}/?device=s6lite`;

    console.log('\x1b[1m\x1b[35m%s\x1b[0m', '📱 [DEVICE 1] SAMSUNG GALAXY S25 ULTRA (1440 × 3120 PORTRAIT)');
    console.log('   Display Specs: 6.9″ Dynamic AMOLED • 19.5:9 Aspect Ratio • 1440 × 3120 px');
    console.log(`   On this computer:            \x1b[1m\x1b[35m${s25LocalUrl}\x1b[0m`);
    console.log(`   On your phone (same Wi-Fi):  \x1b[35m${s25NetworkUrl}\x1b[0m`);
    console.log('   QR Code for Galaxy S25 Ultra / Phone:');
    qrcodeTerminal.generate(s25NetworkUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });

    console.log('\n\x1b[1m\x1b[36m%s\x1b[0m', '📱 [DEVICE 2] SAMSUNG GALAXY TAB S6 LITE (1200 × 2000 PORTRAIT)');
    console.log('   Display Specs: 10.4″ WUXGA+ • 5:3 Aspect Ratio • 1200 × 2000 px');
    console.log(`   On this computer:            \x1b[1m\x1b[36m${s6LocalUrl}\x1b[0m`);
    console.log(`   On your phone (same Wi-Fi):  \x1b[36m${s6NetworkUrl}\x1b[0m`);
    console.log('   QR Code for Galaxy Tab S6 Lite / Tablet:');
    qrcodeTerminal.generate(s6NetworkUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });

    console.log('\x1b[32m%s\x1b[0m', `\n✔ Resolution Testing Server actively listening on port ${actualPort} (host 0.0.0.0).`);
    console.log('\x1b[90m%s\x1b[0m', 'Open links above on desktop for on-screen simulator frame, or scan QR code on mobile device.');
    console.log('\x1b[90m%s\x1b[0m', 'Press Ctrl+C to stop the server.\n');

    const handleShutdown = async () => {
      console.log('\nShutting down resolution testing server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to start resolution server:', error);
    process.exit(1);
  }
}

startResolutionServer();
