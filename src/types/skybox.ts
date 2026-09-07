export type SkyMode = 'gradient_clouds' | 'rayleigh_mie' | 'solid_fog' | 'stylized_ghibli' | 'deep_night';

export type ShadeMode = 'original' | 'vibrant' | 'stylized' | 'ghibli' | 'cinematic';

export type WeatherType = 'clear' | 'overcast' | 'rain' | 'storm' | 'foggy';

export interface AtmosphereSettings {
  globalBrightness: number;
  summerFilter: boolean;
  shadeMode: ShadeMode;
  skyColor: string;
  fogColor: string;
  ambientLightColor: string;
  sunLightColor: string;
  ambientIntensity: number;
  sunIntensity: number;
  waterGlintColor: string;
}

export interface GradientSettings {
  skyMode: SkyMode;
  proceduralSkyDome: boolean;
  enableProceduralClouds: boolean;
  enableGradientCurve: boolean;
  zenithColor: string;
  midSkyColor: string;
  horizonColor: string;
  gradientCurvePower: number;
  midHeightOffset: number;
  sunFlareGlow: number;
  horizonBandGlow: number;
}

export interface CloudSettings {
  cloudCoverage: number;
  cloudEdge: number;
  cloudSpeed: number;
  skyZenith: string;
  skyHorizon: string;
  cloudColor: string;
  cloudShadow: string;
  stormTurbulence: number;
  stormDarken: number;
  cloudOpacity: number;
  cloudAltitude: number; // Height in units (e.g. 500m - 2000m)
  cloudThickness: number;
  weather: WeatherType;
}

export interface SunGodRaySettings {
  sunHeight: number; // Altitude / Elevation in degrees (-15 to 90)
  sunAzimuth: number; // Angle 0 to 360
  lockSunToPlayer: boolean;
  sunDiscSize: number;
  colorTemperature: number; // Kelvin 2000 to 10000
  godRaysEnable: boolean;
  rayIntensity: number;
  rayDensity: number;
  rayDecay: number;
  lumGateMin: number;
  lumGateMax: number;
  highlightRolloff: number;
  horizonGlow: number;
  rayColorInner: string;
  rayColorOuter: string;
}

export interface DistanceFogSettings {
  globalFog: boolean;
  startDist: number;
  endDist: number;
  densityMultiplier: number;
  altitudeScale: number;
  altitudeAutoExpand: boolean;
}

export interface RainSettings {
  enableRain: boolean;
  dropSize: number;
  intensity: number;
  windX: number;
  windZ: number;
  wind: boolean;
  windTrails: boolean;
}

export interface CameraSettings {
  pitch: number; // degrees
  yaw: number; // degrees
  fov: number; // degrees
  altitude: number; // camera height (0 to 3000)
  posX: number;
  posZ: number;
}

export interface EnvironmentPreset {
  id: string;
  name: string;
  timeOfDayHour: number; // 0 - 24
  atmosphere: AtmosphereSettings;
  gradient: GradientSettings;
  clouds: CloudSettings;
  sunGodRays: SunGodRaySettings;
  fog: DistanceFogSettings;
  rain: RainSettings;
}

export interface RenderUniforms {
  time: number;
  resolution: [number, number];
  cameraPos: [number, number, number];
  cameraRot: [number, number, number]; // pitch, yaw, roll
  fov: number;
  sunDir: [number, number, number];
  sunColor: [number, number, number];
  zenithColor: [number, number, number];
  midSkyColor: [number, number, number];
  horizonColor: [number, number, number];
  gradientPower: number;
  midOffset: number;
  cloudCoverage: number;
  cloudEdge: number;
  cloudSpeed: number;
  cloudColor: [number, number, number];
  cloudShadow: [number, number, number];
  cloudOpacity: number;
  cloudAltitude: number;
  godRayEnable: number;
  rayIntensity: number;
  rayDensity: number;
  rayDecay: number;
  lumGate: [number, number];
  rayColorInner: [number, number, number];
  rayColorOuter: [number, number, number];
  fogEnable: number;
  fogStart: number;
  fogEnd: number;
  fogDensity: number;
  fogColor: [number, number, number];
  rainEnable: number;
  rainIntensity: number;
  rainWind: [number, number];
  globalBrightness: number;
  sunDiscSize: number;
  sunFlareGlow: number;
  horizonBandGlow: number;
  summerFilter: number;
  stormTurbulence: number;
  stormDarken: number;
  isNight: number;
  qualityTier: number; // 0.0 = mobile (reduced quality), 1.0 = desktop (full quality)
}
