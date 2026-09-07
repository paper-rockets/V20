import os from 'node:os';
import { createServer } from 'vite';
import qrcodeTerminal from 'qrcode-terminal';

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

async function startDualServers() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '========================================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '  REMIX 3D STUDIO - DUAL DEVICE EMULATION SERVERS (S6 LITE & S25 ULTRA)');
  console.log('\x1b[36m%s\x1b[0m', '========================================================================\n');

  try {
    // 1. Start Server 1: Galaxy Tab S6 Lite (1200 x 2000 portrait)
    const serverS6 = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: 3001,
        cors: true,
      },
    });
    await serverS6.listen();

    // 2. Start Server 2: Galaxy S25 Ultra (1440 x 3120 portrait)
    const serverS25 = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: 3002,
        cors: true,
      },
    });
    await serverS25.listen();

    const localIps = getLocalIpAddresses();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';

    const s6LocalUrl = 'http://localhost:3001/?device=s6lite';
    const s6NetworkUrl = `http://${primaryIp}:3001/?device=s6lite`;

    const s25LocalUrl = 'http://localhost:3002/?device=s25ultra';
    const s25NetworkUrl = `http://${primaryIp}:3002/?device=s25ultra`;

    console.log('\x1b[1m\x1b[33m%s\x1b[0m', '📱 SERVER 1: SAMSUNG GALAXY TAB S6 LITE');
    console.log('  • Display Specs: 1200 × 2000 px (5:3 Aspect Ratio) • 10.4″ WUXGA+');
    console.log(`  • Local URL:     \x1b[1m\x1b[36m${s6LocalUrl}\x1b[0m`);
    console.log(`  • Network URL:   \x1b[36m${s6NetworkUrl}\x1b[0m`);
    console.log('  • QR Code (S6 Lite):');
    qrcodeTerminal.generate(s6NetworkUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });

    console.log('\n\x1b[1m\x1b[35m%s\x1b[0m', '📱 SERVER 2: SAMSUNG GALAXY S25 ULTRA');
    console.log('  • Display Specs: 1440 × 3120 px (19.5:9 Aspect Ratio) • 6.9″ QHD+ AMOLED');
    console.log(`  • Local URL:     \x1b[1m\x1b[35m${s25LocalUrl}\x1b[0m`);
    console.log(`  • Network URL:   \x1b[35m${s25NetworkUrl}\x1b[0m`);
    console.log('  • QR Code (S25 Ultra):');
    qrcodeTerminal.generate(s25NetworkUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });

    console.log('\x1b[32m%s\x1b[0m', '\n✔ Both servers are actively running in portrait display mode.');
    console.log('\x1b[90m%s\x1b[0m', 'Press Ctrl+C to terminate both servers.\n');

    const handleShutdown = async () => {
      console.log('\nShutting down both servers...');
      await serverS6.close();
      await serverS25.close();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (err) {
    console.error('Failed to start dual servers:', err);
    process.exit(1);
  }
}

startDualServers();
