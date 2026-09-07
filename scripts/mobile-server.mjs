import os from 'node:os';
import { createServer } from 'vite';
import qrcodeTerminal from 'qrcode-terminal';

// Parse command line arguments
const args = process.argv.slice(2);
const isHttps = args.includes('--https') || process.env.HTTPS === 'true';
const portArgIndex = args.indexOf('--port');
const requestedPort = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : 3000;

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal (127.0.0.1) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
          isWifi: name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wireless'),
        });
      }
    }
  }

  // Prioritize Wi-Fi interface if available
  addresses.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  return addresses;
}

async function startMobileServer() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   SKETCHBOOK V14 - LOCAL MOBILE TESTING SERVER');
  console.log('\x1b[36m%s\x1b[0m', '=============================================================');
  console.log('\x1b[90m%s\x1b[0m', 'Initializing Vite development server for multi-device testing...\n');

  try {
    const server = await createServer({
      configFile: './vite.config.ts',
      server: {
        host: '0.0.0.0',
        port: requestedPort,
        https: isHttps ? {} : false,
        cors: true,
      },
    });

    await server.listen();

    const actualPort = server.config.server.port || requestedPort;
    const protocol = isHttps ? 'https' : 'http';
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';
    const mobileUrl = `${protocol}://${primaryIp}:${actualPort}`;
    const localUrl = `${protocol}://localhost:${actualPort}`;

    console.log('\x1b[1m\x1b[34m%s\x1b[0m', '📱 SCAN THIS QR CODE WITH YOUR PHONE CAMERA:');
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');
    qrcodeTerminal.generate(mobileUrl, { small: true }, (qrcode) => {
      console.log(qrcode);
    });
    console.log('\x1b[90m%s\x1b[0m', '-------------------------------------------------------------');

    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '🚀 SERVER IS RUNNING & READY FOR MOBILE CONNECTIONS:');
    console.log(`  \x1b[33m➜  Mobile URL:\x1b[0m   \x1b[1m\x1b[36m${mobileUrl}\x1b[0m`);
    console.log(`  \x1b[33m➜  Local URL:\x1b[0m    \x1b[36m${localUrl}\x1b[0m`);

    if (localIps.length > 1) {
      console.log('\n  \x1b[90mOther Available Network Interfaces:\x1b[0m');
      localIps.slice(1).forEach((ip) => {
        console.log(`     • ${ip.name}: \x1b[36m${protocol}://${ip.address}:${actualPort}\x1b[0m`);
      });
    }

    console.log('\n\x1b[1m\x1b[35m%s\x1b[0m', '📋 MOBILE TESTING TIPS:');
    console.log('  1. Ensure your mobile device is on the \x1b[1mSAME Wi-Fi\x1b[0m network.');
    console.log('  2. Point your iOS Camera / Android Google Lens directly at the QR Code above.');
    console.log('  3. In iOS Safari or Android Chrome, use \x1b[1m"Add to Home Screen"\x1b[0m for full-screen view.');
    console.log('  4. Use 1 finger to draw/sculpt, and 2 fingers to rotate, pan, or zoom.');
    if (isHttps) {
      console.log('  5. \x1b[33mHTTPS Mode Active:\x1b[0m If your browser shows a certificate warning, tap "Advanced" -> "Proceed to site".');
    } else {
      console.log('  5. Need gyroscope / device orientation or WebGPU? Run \x1b[36mnpm run dev:https\x1b[0m for SSL.');
    }
    console.log('\n\x1b[90m%s\x1b[0m', 'Press Ctrl+C to stop the server.\n');

    // Keep process alive and handle cleanup
    const handleShutdown = async () => {
      console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down mobile server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to start mobile server:', error);
    process.exit(1);
  }
}

startMobileServer();
