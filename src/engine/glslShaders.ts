export const SKYBOX_VS_GLSL = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const SKYBOX_FS_GLSL = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;

uniform vec3 u_camPos;
uniform vec3 u_camRot; // pitch, yaw, roll (radians)
uniform float u_fov;
uniform float u_globalBrightness;

uniform vec3 u_sunDir;
uniform float u_sunDiscSize;
uniform vec3 u_sunColor;
uniform float u_sunFlareGlow;

uniform vec3 u_zenithColor;
uniform float u_gradientPower;
uniform vec3 u_midSkyColor;
uniform float u_midOffset;
uniform vec3 u_horizonColor;
uniform float u_horizonBandGlow;

uniform float u_cloudCoverage;
uniform float u_cloudEdge;
uniform float u_cloudSpeed;
uniform float u_cloudOpacity;
uniform vec3 u_cloudColor;
uniform vec3 u_cloudShadow;
uniform float u_cloudAltitude;
uniform float u_stormTurbulence;
uniform float u_stormDarken;

uniform float u_godRayEnable;
uniform float u_rayIntensity;
uniform float u_rayDensity;
uniform float u_rayDecay;
uniform vec2 u_lumGate;
uniform float u_highlightRolloff;
uniform vec3 u_rayInner;
uniform vec3 u_rayOuter;

uniform float u_fogEnable;
uniform float u_fogDensity;
uniform float u_altitudeScale;
uniform vec3 u_fogColor;

uniform float u_rainEnable;
uniform float u_rainIntensity;
uniform vec2 u_rainWind;

uniform float u_summerFilter;
uniform float u_isNight;
uniform float u_qualityTier; // 0.0 = mobile, 1.0 = desktop

// Hash functions
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbmCloud(vec2 p, float turbulence) {
  float value = 0.0;
  float amplitude = 0.5;
  float freq = 1.0;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  vec2 cp = p;

  if (turbulence > 0.01) {
    vec2 distort = vec2(
      noise2D(cp * 1.5 + vec2(u_time * 0.02, 0.0)),
      noise2D(cp * 1.5 + vec2(0.0, u_time * 0.02))
    );
    cp += distort * turbulence * 0.8;
  }

  int maxOctaves = (u_qualityTier > 0.5) ? 5 : 3;
  for (int i = 0; i < 5; i++) {
    if (i >= maxOctaves) break;
    value += amplitude * noise2D(cp * freq);
    cp = rot * cp * 2.0 + shift;
    amplitude *= 0.5;
  }
  return value;
}

vec3 getStars(vec3 rayDir) {
  if (rayDir.y < -0.05) return vec3(0.0);
  vec2 uv = rayDir.xz / (rayDir.y + 0.3) * 80.0;
  vec2 gridId = floor(uv);
  float n = hash21(gridId);
  vec3 starCol = vec3(0.0);
  
  if (n > 0.985) {
    vec2 local = fract(uv) - 0.5;
    float dist = length(local);
    float size = (n - 0.985) * 60.0;
    float twinkle = sin(u_time * 3.0 + n * 100.0) * 0.3 + 0.7;
    float bright = smoothstep(0.08, 0.0, dist) * size * twinkle;
    vec3 tint = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.8, 0.6), hash21(gridId + 7.3));
    starCol = tint * bright;
  }
  
  float band = abs(dot(rayDir, normalize(vec3(0.5, 0.8, 0.3))));
  float milkyWay = smoothstep(0.6, 0.0, band) * noise2D(rayDir.xy * 6.0) * 0.15;
  vec3 mwTint = vec3(0.5, 0.6, 0.9) * milkyWay;
  
  return (starCol + mwTint) * smoothstep(-0.05, 0.2, rayDir.y);
}

void main() {
  vec2 ndc = (v_uv * 2.0 - 1.0) * vec2(1.0, -1.0);
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float fovRad = u_fov * 3.14159265 / 180.0;
  float tanHalfFov = tan(fovRad * 0.5);

  vec3 viewRayLocal = normalize(vec3(ndc.x * aspect * tanHalfFov, ndc.y * tanHalfFov, 1.0));

  float cp = cos(u_camRot.x);
  float sp = sin(u_camRot.x);
  float cy = cos(u_camRot.y);
  float sy = sin(u_camRot.y);

  vec3 pitched = vec3(
    viewRayLocal.x,
    viewRayLocal.y * cp - viewRayLocal.z * sp,
    viewRayLocal.y * sp + viewRayLocal.z * cp
  );

  vec3 rayDir = normalize(vec3(
    pitched.x * cy + pitched.z * sy,
    pitched.y,
    -pitched.x * sy + pitched.z * cy
  ));

  vec3 sunDir = normalize(u_sunDir);

  // 1. Sky Gradient
  float height = clamp(rayDir.y + u_camPos.y * 0.0001, 0.0, 1.0);
  float curvedHeight = pow(height, max(u_gradientPower, 0.1));
  float midPoint = clamp(u_midOffset, 0.05, 0.95);

  vec3 skyGradient;
  if (curvedHeight < midPoint) {
    float t = curvedHeight / midPoint;
    skyGradient = mix(u_horizonColor, u_midSkyColor, smoothstep(0.0, 1.0, t));
  } else {
    float t = (curvedHeight - midPoint) / (1.0 - midPoint);
    skyGradient = mix(u_midSkyColor, u_zenithColor, smoothstep(0.0, 1.0, t));
  }

  // Horizon band glow
  float horizonGlowFactor = exp(-abs(rayDir.y) * 8.0) * u_horizonBandGlow;
  skyGradient += u_horizonColor * horizonGlowFactor;

  if (rayDir.y < 0.0) {
    float belowFactor = clamp(-rayDir.y * 3.0, 0.0, 1.0);
    vec3 groundAtmosphere = mix(u_horizonColor * 0.8, u_fogColor * 0.5, 0.5);
    skyGradient = mix(skyGradient, groundAtmosphere, belowFactor);
  }

  // 2. Celestial Sun / Moon
  float sunDot = dot(rayDir, sunDir);
  vec3 sunFinal = vec3(0.0);

  if (u_isNight < 0.5) {
    float sunAngle = acos(clamp(sunDot, -1.0, 1.0));
    float baseSunSize = 0.015 * u_sunDiscSize;
    float sunDisc = smoothstep(baseSunSize, baseSunSize * 0.85, sunAngle);
    float corona = pow(max(sunDot, 0.0), 16.0) * u_sunFlareGlow * 1.5;
    float wideGlow = pow(max(sunDot, 0.0), 3.0) * u_sunFlareGlow * 0.4;
    sunFinal = u_sunColor * (sunDisc * 4.0 + corona + wideGlow);
  } else {
    vec3 moonDir = -sunDir;
    float moonDot = dot(rayDir, moonDir);
    float moonAngle = acos(clamp(moonDot, -1.0, 1.0));
    float moonDiscSize = 0.018 * u_sunDiscSize;
    float moonDisc = smoothstep(moonDiscSize, moonDiscSize * 0.9, moonAngle);
    float moonGlow = pow(max(moonDot, 0.0), 20.0) * 0.5 + pow(max(moonDot, 0.0), 4.0) * 0.15;
    sunFinal = vec3(0.85, 0.92, 1.0) * (moonDisc * 3.0 + moonGlow);
    skyGradient += getStars(rayDir);
  }

  vec3 finalColor = skyGradient + sunFinal;

  // 3. Clouds
  if (u_cloudCoverage > 0.01 && rayDir.y > 0.02) {
    float planeDist = (u_cloudAltitude - u_camPos.y) / max(rayDir.y, 0.01);
    if (planeDist > 0.0) {
      vec2 cloudUV = (u_camPos.xz * vec2(1.0, 0.0) + rayDir.xz * planeDist) * 0.00035;
      vec2 animOffset = vec2(u_time * u_cloudSpeed, u_time * u_cloudSpeed * 0.3);
      float cloudNoise = fbmCloud(cloudUV + animOffset, u_stormTurbulence);

      float threshold = 1.0 - u_cloudCoverage;
      float cloudDensity = smoothstep(threshold - u_cloudEdge, threshold + u_cloudEdge, cloudNoise);
      float sunHighlight = pow(max(dot(rayDir, sunDir), 0.0), 4.0) * 0.5 + 0.5;
      vec3 cloudTint = mix(u_cloudShadow, u_cloudColor, sunHighlight);
      cloudTint = mix(cloudTint, cloudTint * 0.35, u_stormDarken);

      float altitudeFade = smoothstep(0.02, 0.18, rayDir.y);
      float totalCloudAlpha = cloudDensity * u_cloudOpacity * altitudeFade;
      finalColor = mix(finalColor, cloudTint, totalCloudAlpha);
    }
  }

  // 4. God Rays
  if (u_godRayEnable > 0.5 && sunDot > 0.2) {
    float shaftAccum = 0.0;
    float weight = 1.0;
    int maxRaySteps = (u_qualityTier > 0.5) ? 6 : 3;
    for (int i = 0; i < 6; i++) {
      if (i >= maxRaySteps) break;
      float sampleWeight = pow(max(sunDot, 0.0), 6.0) * weight;
      shaftAccum += sampleWeight * u_rayDensity;
      weight *= u_rayDecay;
    }
    vec3 rayColor = mix(u_rayOuter, u_rayInner, clamp(sunDot * 1.2 - 0.2, 0.0, 1.0));
    float lumGate = smoothstep(u_lumGate.x, u_lumGate.y, sunDot);
    vec3 finalShaft = rayColor * shaftAccum * u_rayIntensity * lumGate;
    finalColor += finalShaft;
  }

  // 5. Fog
  if (u_fogEnable > 0.5) {
    float fogFactor = clamp((1.0 - abs(rayDir.y) * u_altitudeScale) * u_fogDensity, 0.0, 1.0);
    finalColor = mix(finalColor, u_fogColor, fogFactor * 0.65);
  }

  // 6. Rain
  if (u_qualityTier > 0.5 && u_rainEnable > 0.5 && u_rainIntensity > 0.05) {
    vec2 rainUV = v_uv * vec2(u_resolution.x / 250.0, u_resolution.y / 18.0);
    vec2 windOffset = vec2(u_rainWind.x * u_time * 2.0, u_rainWind.y * u_time * 2.0);
    vec2 fallOffset = vec2(0.0, u_time * 12.0 * u_rainIntensity);
    float rainNoise = noise2D((rainUV + windOffset + fallOffset) * 2.0);
    float rainStreak = smoothstep(0.92, 0.99, rainNoise) * u_rainIntensity * 0.45;
    vec3 rainColor = mix(vec3(0.8, 0.88, 1.0), vec3(1.0), 0.5);
    finalColor = mix(finalColor, rainColor, rainStreak);
  }

  // 7. Summer warmth
  if (u_summerFilter > 0.5) {
    finalColor *= vec3(1.08, 1.02, 0.92);
  }

  // Brightness & Tone mapping
  finalColor *= u_globalBrightness;
  finalColor = finalColor / (finalColor + vec3(0.85)) * 1.85;
  finalColor = clamp(finalColor, 0.0, 1.0);

  fragColor = vec4(finalColor, 1.0);
}
`;
