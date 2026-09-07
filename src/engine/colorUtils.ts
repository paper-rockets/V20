// Convert Hex string '#RRGGBB' to normalized [r, g, b] (0.0 to 1.0)
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    return [1.0, 1.0, 1.0];
  }
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

// Convert normalized [r, g, b] (0..1) to Hex '#RRGGBB'
export function rgbToHex(rgb: [number, number, number]): string {
  const r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16).padStart(2, '0');
  const g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16).padStart(2, '0');
  const b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Convert Color Temperature in Kelvin (2000K to 10000K) to RGB
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  return [r / 255, g / 255, b / 255];
}

// Convert Altitude (degrees, -90 to +90) and Azimuth (degrees, 0 to 360) to 3D unit vector
export function sphericalToCartesian(altitudeDeg: number, azimuthDeg: number): [number, number, number] {
  const altRad = (altitudeDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;

  const y = Math.sin(altRad);
  const cosAlt = Math.cos(altRad);
  const x = Math.sin(azRad) * cosAlt;
  const z = Math.cos(azRad) * cosAlt;

  return [x, y, z];
}

// Convert 24-hour time (0.0 to 24.0) to Sun Altitude and Azimuth angles
export function timeOfDayToSunAngles(hour: number): { altitude: number; azimuth: number } {
  // 6:00 is sunrise (alt=0, az=90 E), 12:00 is noon (alt=75, az=180 S), 18:00 is sunset (alt=0, az=270 W), 0:00 is midnight (alt=-60)
  const angle = ((hour - 6) / 24) * Math.PI * 2;
  const altitude = Math.sin(angle) * 75; // -75 to +75
  const azimuth = ((hour / 24) * 360 + 90) % 360;

  return { altitude, azimuth };
}
