export const SKYBOX_WGSL = `
struct Uniforms {
  time: f32,
  qualityTier: f32, // 0.0 = mobile, 1.0 = desktop
  resX: f32,
  resY: f32,
  
  camPosX: f32,
  camPosY: f32,
  camPosZ: f32,
  camPitch: f32,
  
  camYaw: f32,
  camRoll: f32,
  fov: f32,
  globalBrightness: f32,
  
  sunDirX: f32,
  sunDirY: f32,
  sunDirZ: f32,
  sunDiscSize: f32,
  
  sunColR: f32,
  sunColG: f32,
  sunColB: f32,
  sunFlareGlow: f32,
  
  zenithColR: f32,
  zenithColG: f32,
  zenithColB: f32,
  gradientPower: f32,
  
  midSkyColR: f32,
  midSkyColG: f32,
  midSkyColB: f32,
  midOffset: f32,
  
  horizonColR: f32,
  horizonColG: f32,
  horizonColB: f32,
  horizonBandGlow: f32,
  
  cloudCoverage: f32,
  cloudEdge: f32,
  cloudSpeed: f32,
  cloudOpacity: f32,
  
  cloudColR: f32,
  cloudColG: f32,
  cloudColB: f32,
  cloudAltitude: f32,
  
  cloudShadowR: f32,
  cloudShadowG: f32,
  cloudShadowB: f32,
  stormTurbulence: f32,
  
  stormDarken: f32,
  godRayEnable: f32,
  rayIntensity: f32,
  rayDensity: f32,
  
  rayDecay: f32,
  lumGateMin: f32,
  lumGateMax: f32,
  highlightRolloff: f32,
  
  rayInnerR: f32,
  rayInnerG: f32,
  rayInnerB: f32,
  summerFilter: f32,
  
  rayOuterR: f32,
  rayOuterG: f32,
  rayOuterB: f32,
  isNight: f32,
  
  fogEnable: f32,
  fogStart: f32,
  fogEnd: f32,
  fogDensity: f32,
  
  fogColR: f32,
  fogColG: f32,
  fogColB: f32,
  altitudeScale: f32,
  
  rainEnable: f32,
  rainIntensity: f32,
  rainWindX: f32,
  rainWindZ: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var out: VertexOutput;
  let p = pos[in_vertex_index];
  out.position = vec4<f32>(p, 0.0, 1.0);
  out.uv = p * 0.5 + 0.5;
  return out;
}

// Pseudo-random hash
fn hash21(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
  var q = vec3<f32>(
    dot(p, vec3<f32>(127.1, 311.7, 74.7)),
    dot(p, vec3<f32>(269.5, 183.3, 246.1)),
    dot(p, vec3<f32>(113.5, 271.9, 124.6))
  );
  return fract(sin(q) * 43758.5453123);
}

// 2D Value Noise
fn noise2D(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u_smooth = f * f * (3.0 - 2.0 * f);

  let a = hash21(i + vec2<f32>(0.0, 0.0));
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u_smooth.x), mix(c, d, u_smooth.x), u_smooth.y);
}

// Fractal Brownian Motion for Ghibli volumetric clouds
fn fbmCloud(p: vec2<f32>, turbulence: f32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var freq = 1.0;
  var shift = vec2<f32>(100.0, 100.0);
  let rot = mat2x2<f32>(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  var current_p = p;

  if (turbulence > 0.01) {
    let distort = vec2<f32>(
      noise2D(current_p * 1.5 + vec2<f32>(u.time * 0.02, 0.0)),
      noise2D(current_p * 1.5 + vec2<f32>(0.0, u.time * 0.02))
    );
    current_p = current_p + distort * turbulence * 0.8;
  }

  let maxOctaves = select(3, 5, u.qualityTier > 0.5);
  for (var i = 0; i < 5; i = i + 1) {
    if (i >= maxOctaves) { break; }
    value = value + amplitude * noise2D(current_p * freq);
    current_p = rot * current_p * 2.0 + shift;
    amplitude = amplitude * 0.5;
  }
  return value;
}

// Generate stars & milky way
fn getStars(rayDir: vec3<f32>) -> vec3<f32> {
  if (rayDir.y < -0.05) { return vec3<f32>(0.0, 0.0, 0.0); }
  
  // Star grid
  let uv = rayDir.xz / (rayDir.y + 0.3) * 80.0;
  let gridId = floor(uv);
  let n = hash21(gridId);
  var starCol = vec3<f32>(0.0, 0.0, 0.0);
  
  if (n > 0.985) {
    let local = fract(uv) - 0.5;
    let dist = length(local);
    let size = (n - 0.985) * 60.0;
    let twinkle = sin(u.time * 3.0 + n * 100.0) * 0.3 + 0.7;
    let bright = smoothstep(0.08, 0.0, dist) * size * twinkle;
    let tint = mix(vec3<f32>(0.8, 0.9, 1.0), vec3<f32>(1.0, 0.8, 0.6), hash21(gridId + 7.3));
    starCol = tint * bright;
  }
  
  // Milky way band
  let band = abs(dot(rayDir, normalize(vec3<f32>(0.5, 0.8, 0.3))));
  let milkyWay = smoothstep(0.6, 0.0, band) * noise2D(rayDir.xy * 6.0) * 0.15;
  let mwTint = vec3<f32>(0.5, 0.6, 0.9) * milkyWay;
  
  return (starCol + mwTint) * smoothstep(-0.05, 0.2, rayDir.y);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Screen space NDC
  let ndc = (in.uv * 2.0 - 1.0) * vec2<f32>(1.0, -1.0);
  let aspect = u.resX / max(u.resY, 1.0);
  let fovRad = u.fov * 3.14159265 / 180.0;
  let tanHalfFov = tan(fovRad * 0.5);

  // Compute view ray direction with pitch and yaw rotations
  let viewRayLocal = normalize(vec3<f32>(ndc.x * aspect * tanHalfFov, ndc.y * tanHalfFov, 1.0));
  
  let cp = cos(u.camPitch);
  let sp = sin(u.camPitch);
  let cy = cos(u.camYaw);
  let sy = sin(u.camYaw);

  // Pitch rotation (around X)
  let pitched = vec3<f32>(
    viewRayLocal.x,
    viewRayLocal.y * cp - viewRayLocal.z * sp,
    viewRayLocal.y * sp + viewRayLocal.z * cp
  );
  
  // Yaw rotation (around Y)
  let rayDir = normalize(vec3<f32>(
    pitched.x * cy + pitched.z * sy,
    pitched.y,
    -pitched.x * sy + pitched.z * cy
  ));

  let sunDir = normalize(vec3<f32>(u.sunDirX, u.sunDirY, u.sunDirZ));
  let sunColor = vec3<f32>(u.sunColR, u.sunColG, u.sunColB);
  let zenithColor = vec3<f32>(u.zenithColR, u.zenithColG, u.zenithColB);
  let midSkyColor = vec3<f32>(u.midSkyColR, u.midSkyColG, u.midSkyColB);
  let horizonColor = vec3<f32>(u.horizonColR, u.horizonColG, u.horizonColB);

  // 1. SKY GRADIENT WITH NON-LINEAR CURVE & MID-OFFSET
  let height = clamp(rayDir.y + u.camPosY * 0.0001, 0.0, 1.0);
  let curvedHeight = pow(height, max(u.gradientPower, 0.1));
  let midPoint = clamp(u.midOffset, 0.05, 0.95);
  
  var skyGradient: vec3<f32>;
  if (curvedHeight < midPoint) {
    let t = curvedHeight / midPoint;
    skyGradient = mix(horizonColor, midSkyColor, smoothstep(0.0, 1.0, t));
  } else {
    let t = (curvedHeight - midPoint) / (1.0 - midPoint);
    skyGradient = mix(midSkyColor, zenithColor, smoothstep(0.0, 1.0, t));
  }

  // Horizon band glow
  let horizonGlowFactor = exp(-abs(rayDir.y) * 8.0) * u.horizonBandGlow;
  skyGradient = skyGradient + horizonColor * horizonGlowFactor;

  // Below horizon ground fog / bottom atmospheric blend
  if (rayDir.y < 0.0) {
    let belowFactor = clamp(-rayDir.y * 3.0, 0.0, 1.0);
    let groundAtmosphere = mix(horizonColor * 0.8, vec3<f32>(u.fogColR, u.fogColG, u.fogColB) * 0.5, 0.5);
    skyGradient = mix(skyGradient, groundAtmosphere, belowFactor);
  }

  // 2. CELESTIAL SUN & MOON
  let sunDot = dot(rayDir, sunDir);
  var sunFinal = vec3<f32>(0.0, 0.0, 0.0);
  
  if (u.isNight < 0.5) {
    // Sun Disc
    let sunAngle = acos(clamp(sunDot, -1.0, 1.0));
    let baseSunSize = 0.015 * u.sunDiscSize;
    let sunDisc = smoothstep(baseSunSize, baseSunSize * 0.85, sunAngle);
    
    // Sun Flare Glow / Corona
    let corona = pow(max(sunDot, 0.0), 16.0) * u.sunFlareGlow * 1.5;
    let wideGlow = pow(max(sunDot, 0.0), 3.0) * u.sunFlareGlow * 0.4;
    
    sunFinal = sunColor * (sunDisc * 4.0 + corona + wideGlow);
  } else {
    // Moon (opposite or aligned with night coordinates)
    let moonDir = -sunDir;
    let moonDot = dot(rayDir, moonDir);
    let moonAngle = acos(clamp(moonDot, -1.0, 1.0));
    let moonDiscSize = 0.018 * u.sunDiscSize;
    let moonDisc = smoothstep(moonDiscSize, moonDiscSize * 0.9, moonAngle);
    let moonGlow = pow(max(moonDot, 0.0), 20.0) * 0.5 + pow(max(moonDot, 0.0), 4.0) * 0.15;
    
    let moonColor = vec3<f32>(0.85, 0.92, 1.0);
    sunFinal = moonColor * (moonDisc * 3.0 + moonGlow);
    
    // Starfield in background
    let stars = getStars(rayDir);
    skyGradient = skyGradient + stars;
  }

  var finalColor = skyGradient + sunFinal;

  // 3. PROCEDURAL VOLUMETRIC GHIBLI CLOUDS
  if (u.cloudCoverage > 0.01 && rayDir.y > 0.02) {
    // Cloud plane intersection at cloudAltitude
    let planeDist = (u.cloudAltitude - u.camPosY) / max(rayDir.y, 0.01);
    
    if (planeDist > 0.0) {
      let cloudUV = (u.camPosX * vec2<f32>(1.0, 0.0) + rayDir.xz * planeDist) * 0.00035;
      let animOffset = vec2<f32>(u.time * u.cloudSpeed, u.time * u.cloudSpeed * 0.3);
      
      let cloudNoise = fbmCloud(cloudUV + animOffset, u.stormTurbulence);
      
      // Coverage threshold and edge softness
      let threshold = 1.0 - u.cloudCoverage;
      let cloudDensity = smoothstep(threshold - u.cloudEdge, threshold + u.cloudEdge, cloudNoise);
      
      // Cloud lighting: direct sun light + ambient shadow
      let sunHighlight = pow(max(dot(rayDir, sunDir), 0.0), 4.0) * 0.5 + 0.5;
      let cloudBase = vec3<f32>(u.cloudColR, u.cloudColG, u.cloudColB);
      let cloudShadow = vec3<f32>(u.cloudShadowR, u.cloudShadowG, u.cloudShadowB);
      
      // Storm darkening
      var cloudTint = mix(cloudShadow, cloudBase, sunHighlight);
      cloudTint = mix(cloudTint, cloudTint * 0.35, u.stormDarken);
      
      // Altitude fade to prevent hard horizon cut
      let altitudeFade = smoothstep(0.02, 0.18, rayDir.y);
      let totalCloudAlpha = cloudDensity * u.cloudOpacity * altitudeFade;
      
      finalColor = mix(finalColor, cloudTint, totalCloudAlpha);
    }
  }

  // 4. VOLUMETRIC GOD RAYS (RADIAL OCCLUSION MARCH)
  if (u.godRayEnable > 0.5 && sunDot > 0.2) {
    // Radial light shaft accumulation
    let rayDirLocal = normalize(rayDir);
    var shaftAccum = 0.0;
    var currentSampleDot = sunDot;
    
    let density = u.rayDensity;
    let decay = u.rayDecay;
    var weight = 1.0;
    let maxRaySteps = select(3, 6, u.qualityTier > 0.5);
    
    for (var i = 0; i < 6; i = i + 1) {
      if (i >= maxRaySteps) { break; }
      let sampleWeight = pow(max(sunDot, 0.0), 6.0) * weight;
      shaftAccum = shaftAccum + sampleWeight * density;
      weight = weight * decay;
    }
    
    let innerCol = vec3<f32>(u.rayInnerR, u.rayInnerG, u.rayInnerB);
    let outerCol = vec3<f32>(u.rayOuterR, u.rayOuterG, u.rayOuterB);
    let rayColor = mix(outerCol, innerCol, clamp(sunDot * 1.2 - 0.2, 0.0, 1.0));
    
    let lumGate = smoothstep(u.lumGateMin, u.lumGateMax, sunDot);
    let finalShaft = rayColor * shaftAccum * u.rayIntensity * lumGate;
    
    finalColor = finalColor + finalShaft;
  }

  // 5. DISTANCE FOG BLENDING
  if (u.fogEnable > 0.5) {
    let fogColor = vec3<f32>(u.fogColR, u.fogColG, u.fogColB);
    let fogFactor = clamp((1.0 - abs(rayDir.y) * u.altitudeScale) * u.fogDensity, 0.0, 1.0);
    finalColor = mix(finalColor, fogColor, fogFactor * 0.65);
  }

  // 6. PROCEDURAL RAIN SIMULATION
  if (u.qualityTier > 0.5 && u.rainEnable > 0.5 && u.rainIntensity > 0.05) {
    let rainUV = in.uv * vec2<f32>(u.resX / 250.0, u.resY / 18.0);
    let windOffset = vec2<f32>(u.rainWindX * u.time * 2.0, u.rainWindZ * u.time * 2.0);
    let fallOffset = vec2<f32>(0.0, u.time * 12.0 * u.rainIntensity);
    
    let rainNoise = noise2D((rainUV + windOffset + fallOffset) * 2.0);
    let rainStreak = smoothstep(0.92, 0.99, rainNoise) * u.rainIntensity * 0.45;
    
    let rainColor = mix(vec3<f32>(0.8, 0.88, 1.0), vec3<f32>(1.0, 1.0, 1.0), 0.5);
    finalColor = mix(finalColor, rainColor, rainStreak);
  }

  // 7. SUMMER WARMTH / ATMOSPHERE POST-PROCESSING
  if (u.summerFilter > 0.5) {
    finalColor = finalColor * vec3<f32>(1.08, 1.02, 0.92);
  }

  // Global Brightness & ACES-like Tone Mapping
  finalColor = finalColor * u.globalBrightness;
  finalColor = finalColor / (finalColor + vec3<f32>(0.85, 0.85, 0.85)) * 1.85;
  finalColor = clamp(finalColor, vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0));

  return vec4<f32>(finalColor, 1.0);
}
`;
