import React from 'react';

// ============================================================================
// Godot Water & Grass Shaders Library & Interactive Presets
// Converted from GDQuest (github.com/gdquest-demos/godot-shaders) and GodotShaders.com
// ============================================================================

export const GODOT_MATERIAL_PRESETS = [
  {
    id: 'godot_wind_grass',
    name: 'Godot: Interactive Wind Grass',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Lush 3D grass blades with procedural Voronoi fibers, triplanar mapping, wind wave shimmer, and player push interaction.',
    generate: (ctx, w, h) => {
const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.4, r * 0.05, cx, cy, r);
      grad.addColorStop(0, '#62df2e');
      grad.addColorStop(0.35, '#2d8c1c');
      grad.addColorStop(0.7, '#144c0c');
      grad.addColorStop(1, '#072004');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

      const rand = (seed) => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
      const bladeColors = ['#1a520f', '#2b781b', '#429e28', '#5ec437', '#7fe34d', '#a4f56c', '#d2ff94'];
      let seed = 42;
      for (let ring = 8; ring < r - 4; ring += 10) {
        const count = Math.floor(ring * 2.2);
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (rand(seed++) - 0.5) * 0.25;
          const dist = ring + (rand(seed++) - 0.5) * 10;
          const bx = cx + Math.cos(angle) * dist;
          const by = cy + Math.sin(angle) * dist;
          const bladeLength = 10 + rand(seed++) * 16;
          const bladeAngle = angle + (rand(seed++) - 0.5) * 0.9 - Math.PI * 0.15;
          const ex = bx + Math.cos(bladeAngle) * bladeLength;
          const ey = by + Math.sin(bladeAngle) * bladeLength;
          const colIdx = Math.min(bladeColors.length - 1, Math.floor(rand(seed++) * bladeColors.length * (dist / r * 0.6 + 0.4)));
          ctx.strokeStyle = bladeColors[colIdx];
          ctx.lineWidth = 1.4 + rand(seed++) * 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          const cpx = (bx + ex) * 0.5 + (rand(seed++) - 0.5) * 6;
          const cpy = (by + ey) * 0.5 + (rand(seed++) - 0.5) * 6;
          ctx.quadraticCurveTo(cpx, cpy, ex, ey);
          ctx.stroke();
        }
      }
      const sunRim = ctx.createRadialGradient(cx * 0.35, cy * 0.25, 10, cx * 0.35, cy * 0.25, r * 0.6);
      sunRim.addColorStop(0, 'rgba(230, 255, 170, 0.45)');
      sunRim.addColorStop(0.5, 'rgba(120, 230, 50, 0.15)');
      sunRim.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunRim;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    vertexShader: `// VERTEX
precision mediump float;
uniform float u_time;
uniform float u_wind_speed;
uniform float u_wind_strength;
uniform float u_blade_fluff;
uniform vec3 u_char_pos;
uniform float u_char_radius;
uniform float u_push_strength;

varying vec3 v_world_pos;
varying vec3 v_local_pos;
varying vec3 v_normal;
varying vec3 v_view_pos;
varying float v_wind_wave;

float hash3D(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3D(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3D(p + vec3(0,0,0)), hash3D(p + vec3(1,0,0)), f.x),
                   mix(hash3D(p + vec3(0,1,0)), hash3D(p + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3D(p + vec3(0,0,1)), hash3D(p + vec3(1,0,1)), f.x),
                   mix(hash3D(p + vec3(0,1,1)), hash3D(p + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
    v_local_pos = position;
    vec3 pos = position;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    
    vec2 windDir = normalize(vec2(1.0, 0.4));
    float wave1 = sin(u_time * u_wind_speed * 2.5 + worldPos.x * 3.0 + worldPos.z * 2.0);
    float wave2 = cos(u_time * u_wind_speed * 4.0 + worldPos.x * 6.0 - worldPos.z * 4.0) * 0.5;
    float windWave = wave1 + wave2;
    v_wind_wave = windWave;

    float tuftNoise = noise3D(pos * 24.0);
    pos += normal * (tuftNoise * u_blade_fluff * 0.12);
    pos += vec3(windDir.x, 0.2, windDir.y) * (windWave * u_wind_strength * 0.08);

    vec3 toChar = worldPos.xyz - u_char_pos;
    toChar.y = 0.0;
    float dist = length(toChar);
    float pushFalloff = 1.0 - smoothstep(0.0, u_char_radius, dist);
    if (dist > 0.001) {
        pos += (inverse(mat3(modelMatrix)) * normalize(toChar)) * (pushFalloff * u_push_strength * 0.15);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    v_world_pos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `// FRAGMENT
precision mediump float;
uniform float u_time;
uniform vec3 u_root_color;
uniform vec3 u_mid_color;
uniform vec3 u_tip_color;
uniform vec3 u_gust_color;
uniform float u_blade_density;
uniform float u_sss_strength;
uniform vec3 u_light_dir;

varying vec3 v_world_pos;
varying vec3 v_local_pos;
varying vec3 v_normal;
varying vec3 v_view_pos;
varying float v_wind_wave;

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoiGrass(vec2 uv, out float bladeHeight, out float bladeId) {
    vec2 g = floor(uv);
    vec2 f = fract(uv);
    float minD = 8.0;
    
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 cell = vec2(float(x), float(y));
            vec2 randPt = hash2(g + cell);
            vec2 offset = 0.5 + 0.35 * sin(u_time * 2.0 + 6.2831 * randPt);
            vec2 delta = cell + offset - f;
            delta.x *= 2.2;
            float d = length(delta);
            if (d < minD) {
                minD = d;
                bladeHeight = clamp(1.0 - (f.y - cell.y * 0.5), 0.0, 1.0);
                bladeId = randPt.x;
            }
        }
    }
    return minD;
}

void main() {
    vec3 norm = normalize(v_normal);
    vec3 viewDir = normalize(v_view_pos);
    vec3 light = normalize(u_light_dir);

    vec3 blend = abs(norm);
    blend = pow(blend, vec3(4.0));
    blend /= (blend.x + blend.y + blend.z);

    vec2 uvX = v_local_pos.yz * u_blade_density;
    vec2 uvY = v_local_pos.xz * u_blade_density;
    vec2 uvZ = v_local_pos.xy * u_blade_density;

    float hX, idX, hY, idY, hZ, idZ;
    float dX = voronoiGrass(uvX, hX, idX);
    float dY = voronoiGrass(uvY, hY, idY);
    float dZ = voronoiGrass(uvZ, hZ, idZ);

    float bladeDist = dX * blend.x + dY * blend.y + dZ * blend.z;
    float bladeHeight = hX * blend.x + hY * blend.y + hZ * blend.z;
    float bladeId = idX * blend.x + idY * blend.y + idZ * blend.z;

    float bladeMask = smoothstep(0.75, 0.15, bladeDist);
    float bladeTip = clamp(bladeHeight + (bladeId - 0.5) * 0.3, 0.0, 1.0);

    vec3 baseColor = mix(u_root_color, u_mid_color, smoothstep(0.0, 0.45, bladeTip));
    baseColor = mix(baseColor, u_tip_color, smoothstep(0.4, 0.95, bladeTip));

    vec3 tintVar = mix(vec3(0.92, 1.05, 0.9), vec3(1.08, 0.95, 1.0), bladeId);
    baseColor *= tintVar;

    float diff = max(dot(norm, light) * 0.5 + 0.5, 0.0);
    
    float windShimmer = smoothstep(0.2, 0.9, v_wind_wave) * bladeTip;
    vec3 finalColor = mix(baseColor * diff, u_gust_color, windShimmer * 0.45);

    float backDot = max(dot(-viewDir, light), 0.0);
    float sss = pow(backDot, 3.0) * bladeTip * u_sss_strength;
    finalColor += u_tip_color * sss;

    float ao = smoothstep(0.0, 0.5, bladeMask) * 0.6 + 0.4;
    finalColor *= ao;

    float rim = pow(1.0 - max(dot(viewDir, norm), 0.0), 3.0);
    finalColor += u_tip_color * (rim * 0.25);

    gl_FragColor = vec4(finalColor, 1.0);
}`,
    uniforms: {
      u_root_color: { type: 'color', label: 'Dark Root Color', value: '#0a2906' },
      u_mid_color: { type: 'color', label: 'Lush Mid Blade', value: '#2e821e' },
      u_tip_color: { type: 'color', label: 'Sunlit Tip Color', value: '#8ae638' },
      u_gust_color: { type: 'color', label: 'Wind Wave Sheen', value: '#e2ff7a' },
      u_blade_density: { type: 'range', label: 'Blade Density', value: 36.0, min: 10.0, max: 80.0, step: 2.0 },
      u_blade_fluff: { type: 'range', label: 'Fluffiness / Silhouette', value: 0.35, min: 0.0, max: 1.0, step: 0.05 },
      u_wind_speed: { type: 'range', label: 'Wind Speed', value: 1.0, min: 0.1, max: 4.0, step: 0.1 },
      u_wind_strength: { type: 'range', label: 'Wind Wave Sway', value: 0.35, min: 0.0, max: 1.0, step: 0.02 },
      u_sss_strength: { type: 'range', label: 'Subsurface Glow', value: 0.45, min: 0.0, max: 1.0, step: 0.05 },
      u_push_strength: { type: 'range', label: 'Player Repulsion', value: 0.6, min: 0.0, max: 2.0, step: 0.05 },
      u_char_radius: { type: 'range', label: 'Push Radius', value: 2.5, min: 0.5, max: 6.0, step: 0.2 },
      u_char_pos: { type: 'vector', label: 'Player Position', value: [0.0, 0.0, 0.0] },
      u_light_dir: { type: 'vector', label: 'Sun Light Dir', value: [0.5, 0.8, 0.3] }
    }
  },
  {
    id: 'godot_foliage_grass',
    name: 'Godot: Foliage Clump Grass',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'GDQuest foliage clump grass with synchronized directional wave propagation.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.5, h*0.5, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#88d840');
      grad.addColorStop(0.6, '#3a8e22');
      grad.addColorStop(1, '#0e380a');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
uniform float u_wind_speed;
uniform float u_wind_strength;
uniform float u_wave_size;

varying vec2 v_uv;
varying vec3 v_normal;

void main() {
    v_uv = uv;
    vec2 windDir = normalize(vec2(1.0, -0.5));
    vec4 worldPos = modelMatrix * vec4(position, 1.0);

    float wave = sin(u_time * u_wind_speed * 2.5 + (worldPos.x * windDir.x + worldPos.z * windDir.y) / max(u_wave_size, 0.1));
    float heightMask = 1.0 - uv.y;

    vec3 dispPos = position;
    dispPos.xz += windDir * (wave * heightMask * u_wind_strength);

    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(dispPos, 1.0);
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform vec3 u_tint;
varying vec2 v_uv;
varying vec3 v_normal;

void main() {
    float height = 1.0 - v_uv.y;
    vec3 baseColor = mix(vec3(0.08, 0.22, 0.05), u_tint, height);
    float diff = max(dot(v_normal, normalize(vec3(0.4, 0.8, 0.3))), 0.0) * 0.5 + 0.5;
    gl_FragColor = vec4(baseColor * diff, 1.0);
},,

,
,
    , 
,
`,
    uniforms: {
      u_tint: { type: 'color', label: 'Foliage Tint', value: '#6bc928' },
      u_wind_speed: { type: 'range', label: 'Wave Frequency', value: 1.2, min: 0.1, max: 4.0, step: 0.1 },
      u_wind_strength: { type: 'range', label: 'Wave Amplitude', value: 0.25, min: 0.0, max: 1.0, step: 0.02 },
      u_wave_size: { type: 'range', label: 'Wavelength', value: 3.5, min: 1.0, max: 10.0, step: 0.5 }
    }
  },
  {
    id: 'godot_water_3d',
    name: 'Godot: 3D Stylized Water',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'GDQuest 3D water with refraction distortion, depth gradient, and shoreline foam.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.35, h*0.35, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#a8f5ff');
      grad.addColorStop(0.3, '#32b4e8');
      grad.addColorStop(0.7, '#0e58a8');
      grad.addColorStop(1, '#05224e');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
uniform float u_wave_height;
uniform float u_wave_speed;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
    v_uv = uv;
    vec3 pos = position;
    float w1 = sin(pos.x * 5.0 + u_time * u_wave_speed * 2.0) * cos(pos.z * 5.0 + u_time * u_wave_speed * 1.5);
    pos.y += w1 * u_wave_height;
    
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform vec3 u_deep_color;
uniform vec3 u_shallow_color;
uniform vec3 u_foam_color;
uniform float u_foam_amount;
uniform float u_refraction_speed;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 refUv1 = v_uv * 12.0 + vec2(u_time * u_refraction_speed * 0.8, u_time * u_refraction_speed * 0.5);
    vec2 refUv2 = v_uv * 16.0 - vec2(u_time * u_refraction_speed * 0.6, u_time * u_refraction_speed * 0.9);
    float n = (noise(refUv1) + noise(refUv2)) * 0.5;

    vec3 viewDir = normalize(v_view_pos);
    float fresnel = pow(1.0 - max(dot(viewDir, normalize(v_normal)), 0.0), 3.0);

    vec3 waterColor = mix(u_shallow_color, u_deep_color, 1.0 - fresnel * 0.6);
    
    float foam = smoothstep(0.65 - u_foam_amount * 0.15, 0.85, n);
    vec3 finalColor = mix(waterColor, u_foam_color, foam * 0.85);

    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(v_normal, halfVec), 0.0), 64.0) * 1.2;
    finalColor += vec3(spec);

    gl_FragColor = vec4(finalColor, 0.92);
},,

,
,
    , 
,
`,
    uniforms: {
      u_shallow_color: { type: 'color', label: 'Shallow Color', value: '#38d9d2' },
      u_deep_color: { type: 'color', label: 'Deep Abyss Color', value: '#0a3670' },
      u_foam_color: { type: 'color', label: 'Foam Tint', value: '#ffffff' },
      u_wave_height: { type: 'range', label: 'Wave Elevation', value: 0.08, min: 0.0, max: 0.3, step: 0.01 },
      u_wave_speed: { type: 'range', label: 'Wave Motion Speed', value: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      u_refraction_speed: { type: 'range', label: 'Refraction Flow', value: 0.25, min: 0.05, max: 1.0, step: 0.05 },
      u_foam_amount: { type: 'range', label: 'Crest Foam Intensity', value: 1.5, min: 0.0, max: 3.0, step: 0.1 }
    }
  },
  {
    id: 'godot_waterfall',
    name: 'Godot: 3D Stylized Waterfall',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'GDQuest stylized waterfall with dual noise scrolling, stepped foam edges, and edge rim glow.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#005599');
      grad.addColorStop(0.5, '#1fb2d8');
      grad.addColorStop(1, '#e6fbff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for(let i=0; i<8; i++) {
        ctx.fillRect(w*0.2 + i*28, h*0.2 + (i%3)*40, 12, 60);
      }
    },
    vertexShader: `precision mediump float;
uniform float u_time;
uniform float u_flow_speed;
uniform float u_displacement;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    v_uv = uv;
    vec2 flowUv = uv * vec2(4.0, 1.0) + vec2(0.0, u_time * u_flow_speed * 1.5);
    float n = noise(flowUv);

    vec3 pos = position + normal * (n * u_displacement);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform float u_flow_speed;
uniform vec3 u_deep_color;
uniform vec3 u_surface_color;
uniform vec3 u_foam_color;
uniform float u_cutoff;
uniform float u_foam_edge_cutoff;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 mainUv = v_uv * vec2(6.0, 1.5) + vec2(0.05, 0.6) * (u_time * u_flow_speed);
    vec2 detailUv = v_uv * vec2(12.0, 3.0) + vec2(0.05, 1.2) * (u_time * u_flow_speed);

    float mainNoise = noise(mainUv);
    float detailNoise = noise(detailUv);
    float combinedNoise = mainNoise * detailNoise;

    float foamEdge = step(u_cutoff, combinedNoise);
    float foamLine = step(u_foam_edge_cutoff, combinedNoise);

    vec3 waterCol = mix(u_deep_color, u_surface_color, mainNoise);
    vec3 finalCol = mix(waterCol, u_foam_color, foamEdge);
    finalCol = mix(finalCol, u_foam_color, foamLine);

    vec3 viewDir = normalize(v_view_pos);
    float fresnel = pow(1.0 - max(dot(normalize(v_normal), viewDir), 0.0), 3.0);
    finalCol += u_foam_color * (fresnel * 0.35);

    gl_FragColor = vec4(finalCol, 0.95);
},,

,
,
    , 
,
`,
    uniforms: {
      u_deep_color: { type: 'color', label: 'Waterfall Abyss', value: '#004d99' },
      u_surface_color: { type: 'color', label: 'Torrent Turquoise', value: '#1ab3cc' },
      u_foam_color: { type: 'color', label: 'Cascade Foam', value: '#f0fbff' },
      u_flow_speed: { type: 'range', label: 'Cascade Flow Speed', value: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      u_cutoff: { type: 'range', label: 'Foam Cutoff', value: 0.22, min: 0.05, max: 0.5, step: 0.01 },
      u_foam_edge_cutoff: { type: 'range', label: 'Edge Line Cutoff', value: 0.42, min: 0.1, max: 0.8, step: 0.01 },
      u_displacement: { type: 'range', label: 'Surface Jiggle', value: 0.06, min: 0.0, max: 0.2, step: 0.01 }
    }
  },
  {
    id: 'godot_absorption_water',
    name: 'Godot: Absorption Water (Beer Law)',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Physical Beer-Lambert exponential depth light absorption with procedural caustics.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.5, h*0.5, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#42f5e9');
      grad.addColorStop(0.4, '#1b9cd9');
      grad.addColorStop(0.8, '#0b397b');
      grad.addColorStop(1, '#02122d');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;
varying vec3 v_world_pos;

void main() {
    v_uv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    v_world_pos = worldPos.xyz;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform vec3 u_absorption_color;
uniform vec3 u_shallow_color;
uniform float u_absorption_strength;
uniform float u_caustics_strength;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;
varying vec3 v_world_pos;

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}
float voronoi(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = hash2(i + g);
            o = 0.5 + 0.5 * sin(u_time * 2.0 + 6.2831 * o);
            md = min(md, length(g + o - f));
        }
    }
    return md;
}

void main() {
    vec3 viewDir = normalize(v_view_pos);
    float fresnel = pow(1.0 - max(dot(viewDir, normalize(v_normal)), 0.0), 3.0);

    float fakeDepth = (1.0 - fresnel) * 4.0;
    vec3 transmission = exp(-u_absorption_color * (fakeDepth * u_absorption_strength));
    vec3 waterColor = mix(u_shallow_color, vec3(0.01, 0.06, 0.18), 1.0 - transmission.r);

    vec2 cUv1 = v_uv * 16.0 + vec2(u_time * 0.15, u_time * 0.1);
    vec2 cUv2 = v_uv * 20.0 - vec2(u_time * 0.12, u_time * 0.18);
    float c1 = voronoi(cUv1);
    float c2 = voronoi(cUv2);
    float caustics = pow(1.0 - min(c1, c2), 3.0) * u_caustics_strength;

    vec3 finalColor = waterColor + vec3(caustics * 0.7) * transmission;
    
    vec3 light = normalize(vec3(0.6, 0.7, 0.4));
    vec3 halfV = normalize(light + viewDir);
    float spec = pow(max(dot(v_normal, halfV), 0.0), 96.0) * 1.5;
    finalColor += vec3(spec);

    gl_FragColor = vec4(finalColor, 0.94);
},,

,
,
    , 
,
`,
    uniforms: {
      u_absorption_color: { type: 'color', label: 'Absorption Tint', value: '#ff5900' },
      u_shallow_color: { type: 'color', label: 'Shallow Waters', value: '#36ebd9' },
      u_absorption_strength: { type: 'range', label: 'Extinction Density', value: 0.6, min: 0.1, max: 2.0, step: 0.05 },
      u_caustics_strength: { type: 'range', label: 'Caustics Sparkle', value: 0.8, min: 0.0, max: 2.0, step: 0.1 }
    }
  },
  {
    id: 'godot_stylized_toon_water',
    name: 'Godot: Stylized Toon Water',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Anime / Ghibli stylized water with stepped color banding and surface contour foam.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.4, h*0.4, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#54c4ff');
      grad.addColorStop(0.5, '#1b80db');
      grad.addColorStop(1, '#0d408f');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(w*0.5, h*0.5, w*0.35, 0.5, 2.5); ctx.stroke();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
uniform float u_speed;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
    v_uv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform float u_speed;
uniform vec3 u_surface_color;
uniform vec3 u_deep_color;
uniform vec3 u_foam_color;
uniform float u_bands;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv1 = v_uv * 10.0 + vec2(u_time * u_speed * 0.15, 0.0);
    vec2 uv2 = v_uv * 10.0 + vec2(0.0, u_time * u_speed * 0.12);

    float n1 = noise(uv1);
    float n2 = noise(uv2);
    float wave = (n1 + n2) * 0.5;

    float stepped = floor(wave * u_bands) / u_bands;
    float foam = step(0.68, wave);

    vec3 col = mix(u_deep_color, u_surface_color, stepped);
    col = mix(col, u_foam_color, foam);

    gl_FragColor = vec4(col, 0.9);
},,

,
,
    , 
,
`,
    uniforms: {
      u_surface_color: { type: 'color', label: 'Sunlit Surface', value: '#2892d7' },
      u_deep_color: { type: 'color', label: 'Shadowed Base', value: '#0d408f' },
      u_foam_color: { type: 'color', label: 'Contour Foam', value: '#ffffff' },
      u_speed: { type: 'range', label: 'Wave Evolution Speed', value: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      u_bands: { type: 'range', label: 'Quantized Bands', value: 4.0, min: 2.0, max: 10.0, step: 1.0 }
    }
  },
  {
    id: 'godot_realistic_water',
    name: 'Godot: Realistic Gerstner Ocean',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Multi-octave trochoidal Gerstner ocean waves with analytical normal generation and specular glints.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.35, h*0.3, 5, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.15, '#7ee6d8');
      grad.addColorStop(0.5, '#16697a');
      grad.addColorStop(0.85, '#093145');
      grad.addColorStop(1, '#021017');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
uniform float u_wave_height;
uniform float u_speed;

varying vec2 v_uv;
varying vec3 v_world_pos;
varying vec3 v_normal;

vec3 gerstnerWave(vec2 dir, float steepness, float wavelength, vec2 pos, inout vec3 tangent, inout vec3 binormal) {
    float k = 6.28318 / wavelength;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(dir);
    float f = k * (dot(d, pos) - c * (u_time * u_speed * 0.8));
    float a = steepness / k;

    tangent += vec3(-d.x * d.x * (steepness * sin(f)), d.x * (steepness * cos(f)), -d.x * d.y * (steepness * sin(f)));
    binormal += vec3(-d.x * d.y * (steepness * sin(f)), d.y * (steepness * cos(f)), -d.y * d.y * (steepness * sin(f)));

    return vec3(d.x * (a * cos(f)), a * sin(f) * u_wave_height, d.y * (a * cos(f)));
}

void main() {
    v_uv = uv;
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    vec3 disp = vec3(0.0);
    disp += gerstnerWave(vec2(1.0, 0.3), 0.22, 1.8, pos.xz, tangent, binormal);
    disp += gerstnerWave(vec2(0.6, 0.8), 0.15, 1.1, pos.xz, tangent, binormal);
    disp += gerstnerWave(vec2(-0.4, 0.9), 0.09, 0.5, pos.xz, tangent, binormal);

    pos += disp;
    v_world_pos = (modelMatrix * vec4(pos, 1.0)).xyz;
    v_normal = normalize(normalMatrix * cross(binormal, tangent));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform vec3 u_deep_color;
uniform vec3 u_shallow_color;
uniform vec3 u_sun_dir;

varying vec2 v_uv;
varying vec3 v_world_pos;
varying vec3 v_normal;

void main() {
    vec3 viewDir = normalize(cameraPosition - v_world_pos);
    vec3 surfNorm = normalize(v_normal);
    float fresnel = pow(1.0 - max(dot(viewDir, surfNorm), 0.0), 4.0);

    vec3 lightDir = normalize(u_sun_dir);
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(surfNorm, halfVec), 0.0), 128.0) * 1.8;

    vec3 col = mix(u_deep_color, u_shallow_color, fresnel * 0.7);
    col += vec3(spec);

    gl_FragColor = vec4(col, 0.95);
},,

,
,
    , 
,
`,
    uniforms: {
      u_deep_color: { type: 'color', label: 'Deep Ocean Trench', value: '#082136' },
      u_shallow_color: { type: 'color', label: 'Swell Turquoise', value: '#1a828a' },
      u_wave_height: { type: 'range', label: 'Gerstner Height', value: 0.12, min: 0.0, max: 0.35, step: 0.01 },
      u_speed: { type: 'range', label: 'Ocean Speed', value: 1.0, min: 0.1, max: 3.0, step: 0.1 },
      u_sun_dir: { type: 'vector', label: 'Sun Position Vector', value: [0.6, 0.8, 0.2] }
    }
  },
  {
    id: 'godot_toon_water_roystan',
    name: 'Godot: Roystan Toon Water',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Erik Roystan Ross style toon water with surface noise foam and stepped color levels.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.35, h*0.35, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#55c9ff');
      grad.addColorStop(0.6, '#0b70c9');
      grad.addColorStop(1, '#00264d');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
    v_uv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform vec3 u_surface_color;
uniform vec3 u_deep_color;
uniform vec3 u_foam_color;
uniform float u_foam_cutoff;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 fUv1 = v_uv * 14.0 + vec2(u_time * 0.12, u_time * 0.06);
    vec2 fUv2 = v_uv * 14.0 - vec2(u_time * 0.09, u_time * 0.09);
    float n = (noise(fUv1) + noise(fUv2)) * 0.5;

    vec3 viewDir = normalize(v_view_pos);
    float depthDiff = pow(1.0 - max(dot(viewDir, normalize(v_normal)), 0.0), 2.0);

    float isFoam = step(u_foam_cutoff, n);
    float edgeFoam = step(0.65, depthDiff + n * 0.25);
    isFoam = max(isFoam, edgeFoam);

    vec3 col = mix(u_surface_color, u_deep_color, depthDiff);
    col = mix(col, u_foam_color, isFoam);

    gl_FragColor = vec4(col, 0.92);
},,

,
,
    , 
,
`,
    uniforms: {
      u_surface_color: { type: 'color', label: 'Surface Aquamarine', value: '#30a5ff' },
      u_deep_color: { type: 'color', label: 'Deep Cyan', value: '#004380' },
      u_foam_color: { type: 'color', label: 'Foam White', value: '#ffffff' },
      u_foam_cutoff: { type: 'range', label: 'Foam Threshold', value: 0.65, min: 0.3, max: 0.9, step: 0.02 }
    }
  },
  {
    id: 'godot_liquid_glass_ui',
    name: 'Godot: Liquid Glass UI',
    category: '🌿 Godot Water & Grass',
    type: 'shader',
    description: 'Frosted liquid glass with chromatic dispersion, normal dome refraction, and bevel rim.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.5, h*0.5, 10, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(180,220,255,0.6)');
      grad.addColorStop(0.85, 'rgba(100,160,240,0.8)');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
    v_uv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    v_view_pos = -mv.xyz;
    v_normal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
},,

,
    , 
    ,\n    `,
    fragmentShader: `precision mediump float;
uniform float u_time;
uniform vec3 u_glass_tint;
uniform float u_warp;
uniform float u_chromatic;
uniform float u_frosted;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
    vec2 center = vec2(0.5);
    vec2 offset = v_uv - center;
    float dist = length(offset);

    vec2 warp = normalize(offset + 1e-4) * pow(dist, 2.0) * u_warp;
    
    vec3 col;
    col.r = sin((v_uv.x + warp.x + u_chromatic) * 20.0 + u_time) * 0.5 + 0.5;
    col.g = sin((v_uv.x + warp.x) * 20.0 + u_time) * 0.5 + 0.5;
    col.b = sin((v_uv.x + warp.x - u_chromatic) * 20.0 + u_time) * 0.5 + 0.5;

    float edge = smoothstep(0.40, 0.48, dist) * (1.0 - smoothstep(0.48, 0.50, dist));
    vec3 finalCol = mix(col * u_glass_tint, vec3(1.0), edge * 0.9);

    vec3 viewDir = normalize(v_view_pos);
    float fresnel = pow(1.0 - max(dot(viewDir, normalize(v_normal)), 0.0), 2.5);
    finalCol += vec3(fresnel * 0.4);

    gl_FragColor = vec4(finalCol, 0.88);
},,

,
,
    , 
,
`,
    uniforms: {
      u_glass_tint: { type: 'color', label: 'Liquid Glass Tint', value: '#d4edff' },
      u_warp: { type: 'range', label: 'Refraction Warp', value: 0.15, min: 0.0, max: 0.5, step: 0.01 },
      u_chromatic: { type: 'range', label: 'Chromatic Dispersion', value: 0.03, min: 0.0, max: 0.1, step: 0.005 },
      u_frosted: { type: 'range', label: 'Frostiness Diffusion', value: 0.35, min: 0.0, max: 1.0, step: 0.05 }
    }
  }
];


export const GODOT_SHADERS_EXTRACTED = [
  {
    "name": "godot-wind-grass",
    "title": "GDQuest 3D Interactive Wind Grass",
    "category": "Godot Water & Grass",
    "path": "godot/Shaders/wind_grass.gdshader",
    "files": {
      "wind_grass.gdshader": "shader_type spatial;\nrender_mode cull_disabled, unshaded;\n\nuniform float wind_speed = 0.05;\nuniform float wind_strength = 2.0;\n// How big, in world space, is the noise texture\n// wind will tile every wind_texture_tile_size\nuniform float wind_texture_tile_size = 20.0;\nuniform float wind_vertical_strength = 0.3;\nuniform vec2 wind_horizontal_direction = vec2(1.0, 0.5);\n\nuniform sampler2D color_ramp : source_color;\n// we need a tiling noise here!\nuniform sampler2D wind_noise : hint_default_black;\n\nuniform vec3 character_position;\nuniform float character_radius = 3.0;\nuniform sampler2D character_distance_falloff_curve : hint_default_black;\nuniform float character_push_strength = 1.0;\n\nvarying float debug_wind;\n\nvoid vertex() {\n\tvec3 world_vert = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;\n\n\tvec2 normalized_wind_direction = normalize(wind_horizontal_direction);\n\tvec2 world_uv = world_vert.xz / wind_texture_tile_size + normalized_wind_direction * TIME * wind_speed;\n\t// we displace only the top part of the mesh\n\t// note that this means that the mesh needs to have UV in a way that the bottom of UV space\n\t// is at the top of the mesh\n\tfloat displacement_affect = (1.0 - UV.y);\n\tfloat wind_noise_intensity = (textureLod(wind_noise, world_uv, 0.0).r - 0.5);\n\n\t// We"
    }
  },
  {
    "name": "godot-foliage-grass",
    "title": "GDQuest Foliage Clump Grass",
    "category": "Godot Water & Grass",
    "path": "godot/Demos/WindTrees/foliage_wind_grass.gdshader",
    "files": {
      "foliage_wind_grass.gdshader": "shader_type spatial;\nrender_mode cull_disabled;\n\nuniform vec4 albedo : source_color;\nuniform sampler2D texture_albedo : source_color;\nuniform float alpha_scissor_threshold;\nuniform float roughness : hint_range(0,1);\nuniform sampler2D texture_normal : hint_normal;\nuniform float normal_scale : hint_range(-16,16);\nuniform vec4 transmission : source_color;\n\nuniform sampler2D texture_wind_noise : hint_default_black;\nuniform float wind_angle : hint_range(0, 360);\nuniform float wind_strength : hint_range(0.0, 2.0) = 1.0;\nuniform float wind_frequency : hint_range(0.0, 2.0) = .05;\nuniform float wind_speed : hint_range(0.0, 2.0) = .25;\nuniform float stretch_correction : hint_range(0.0, 2.0) = 0.5;\n\nfloat rand(vec3 p) {\n\treturn fract(sin(dot(p,vec3(127.1,311.7, 74.7)))*43758.5453123);\n}\n\nvec3 rotate (vec3 v, vec3 n, float a) { \n\treturn v * cos(a) + cross(n, v) * sin(a) + n * dot(n, v) * (1. - cos(a))"
    }
  },
  {
    "name": "godot-water-3d",
    "title": "GDQuest 3D Stylized Water",
    "category": "Godot Water & Grass",
    "path": "godot/Shaders/water_3d.gdshader",
    "files": {
      "water_3d.gdshader": "shader_type spatial;\nrender_mode unshaded;\n\nuniform vec4 deep_color : source_color;\nuniform vec4 shallow_color : source_color = vec4(1);\n\nuniform float refraction_speed = 0.25;\nuniform float refraction_strength = 1.0;\n\nuniform float foam_amount = 1.0;\nuniform float foam_cutoff = 1.0;\nuniform vec4 foam_color : source_color = vec4(1);\n\nuniform float displacement_strength = 0.25;\n\nuniform float depth_distance = 1.0;\n\nuniform vec2 movement_direction = vec2(1,0);\n\nuniform sampler2D refraction_noise : hint_normal;\nuniform sampler2D foam_noise : hint_default_black;\nuniform sampler2D displacement_noise : hint_default_black;\n\nvoid vertex() {\n\tfloat displacement = textureLod(\n\t\t\tdisplacement_noise, \n\t\t\tUV + (TIME * movement_direc"
    }
  },
  {
    "name": "godot-waterfall",
    "title": "GDQuest 3D Stylized Waterfall",
    "category": "Godot Water & Grass",
    "path": "godot/Shaders/stylized_waterfall.gdshader",
    "files": {
      "stylized_waterfall.gdshader": "shader_type spatial;\n\n// ANCHOR: main_noise\nuniform sampler2D main_noise;\nuniform vec2 main_noise_scale = vec2(5.7, 1.0);\n// END: main_noise\n// ANCHOR: detail_noise\nuniform sampler2D detail_noise;\nuniform vec2 detail_noise_scale = vec2(2.5);\n// END: detail_noise\n// ANCHOR: water_speed\nuniform float water_speed = 0.2;\n// END: water_speed\n// ANCHOR: displacement\nuniform float displacement = 0.444;\n// END: displacement\n// ANCHOR: foam_color\nuniform vec4 foam_color: source_color = vec4(1.0);\n// END: foam_color\n// ANCHOR: foam_threshold\nuniform float foam_threshold = 0.5;\n// END: foam_threshold\n// ANCHOR: foam_detail_threshold\nuniform float foam_detail_threshold = 0.7;\n// END: foam_detail_threshold\n// ANCHOR: smoothness\nuniform float foam_smoothness = 0.063;\n// END: smoothness\n// ANCHOR: max_depth\nuniform float max_depth = 1.0;\n// END: max_depth\n// ANCHOR: depth_color\nuniform sampler2D depth_color_curve;\n// END: depth_color\n// ANCHOR: depth_foam_offset\nuniform float depth_foam_offset= 0.25;\n// END: depth_foam_offset\n// debug uniforms!\n// we can use these uniform to peek behind the scenes\n// most of the heavy lifting in this effect is done by\n// clever UV unwrapping and vertex colors.\nuniform bool debug_vertex_color = false;\nuniform bool debug_uv = false;\nuniform sampler2D debug_uv_color_grid: source_color;\n\n// ANCHOR: overlay_blend\n// Overlay blend makes everything better.\nfloat overlay_blend(float a, float b) {\n\treturn mix(\n\t\t\ta * b * 2.0,\n\t\t\t1.0 - 2.0 * (1.0 - a) * (1.0 - b),\n\t\t\tstep(0.5, a));\n}\n// END: overlay_blend\n\nvoid vertex() {\n\tif (!(debug_vertex_color || debug_uv)) {\n\t\t// ANCHOR: noise_uv_offset\n\t\tvec2 noise_uv_offset = vec2(UV.x, UV.y + TIME * water_speed) * main_noise_scale;\n\t\t// END: noise_uv_offset\n\t\t// ANCHOR: sample_main_noise\n\t\tfloat main_noise_value = textureLod(\n\t\t\t\tmain_noise, \n\t\t\t\tnoise_uv_offset, \n\t\t\t\t3.0).r;\n\t\t// END: sample_main_noise\n\t\t// ANCHOR: foam_smoothstep\n\t\tfloat foam_factor = smoothstep(\n\t\t\t\t0.0, \n\t\t\t\t(1.0 - foam_threshold), \n\t\t\t\tmain_noise_value - foam_threshold + COLOR.r * 0.2);\n\t\t// END: foam_smoothstep\n\t\t// ANCHOR: vertex_overlay\n\t\tfoam_factor = overlay_blend(foam_factor, COLOR.r);\n\t\t// END: vertex_overlay\n\t\t// ANCHOR: vertex_displacement\n\t\tVERTEX += NORMAL * foam_factor * displacement;\n\t\t// END: vertex_displacement\n\t}\n}\n\nvoid fragment() {\n\tif (debug_vertex_color) {"
    }
  },
  {
    "name": "godot-water-2d",
    "title": "GDQuest 2D Water Distortion",
    "category": "Godot Water & Grass",
    "path": "godot/Shaders/water_2D.gdshader",
    "files": {
      "water_2D.gdshader": "shader_type canvas_item;\n\nuniform vec4 shadow_color : source_color;\n\nuniform float tile_factor = 10.0;\nuniform float aspect_ratio = 0.5;\n\nuniform sampler2D texture_offset_uv : hint_default_black;\nuniform vec2 texture_offset_scale = vec2(0.2, 0.2);\nuniform float texture_offset_height = 0.1;\n\nuniform float texture_offset_time_scale = 0.05;\n\nuniform float sine_time_scale = 0.03;\nuniform vec2 sine_offset_scale = vec2(0.4, 0.4);\nuniform float sine_wave_size = 0.4;\n\nvec2 calculate_sine_wave(float time, float multiplier, vec2 uv, vec2 offset_scale) {\n\tfloat time_multiplied = time * multiplier;\n\tfloat unique_offset = uv"
    }
  },
  {
    "name": "godot-water-sidescroll",
    "title": "GDQuest 2D Sidescroll Ocean",
    "category": "Godot Water & Grass",
    "path": "godot/Demos/WaterSidescroll2D",
    "files": {
      "water_sidescroll_2D_full.gdshader": "shader_type canvas_item;\n\nuniform sampler2D transition_gradient :hint_default_black;\nuniform sampler2D distortion_map : hint_default_black;\n\nuniform vec4 water_tint :source_color;\nuniform vec4 shadow_color :source_color;\n\nuniform vec2 distortion_scale = vec2(0.5, 0.5);\nuniform float distortion_time_scale :hint_range(0.01, 0.2) = 0.05;\nuniform float distortion_amplitude :hint_range(0.001, 0.05) = 0.1;\n\nuniform float tile_factor :hint_range(0.1, 10.0) = 1.4;\nuniform float water_time_scale :hint_range(0.05, 2.0) = 0.1;\n\nuniform float reflection_intensity :hint_range(0.0, 1.0) = 0.5;\n\nuniform mat3 transform = mat3(vec3(1,0,0), vec3(0,1,0), vec3(0,0,1));\n\nuniform float parallax_factor :hint_range(0.0, 1.0) = 0.2;\n\nuniform vec4 shore_color :source_color = vec4(1.0);\nuniform float shore_size :hint_range(0.0, 0.2) = 0.01;\nuniform float shore_smoothness :hint_range(0.0, 0.1) = 0.02;\nuniform float shore_height_factor :hint_range(0.01, 1.0) = 0.1;\n\n// Updated from GDScript\nuniform vec2 scale;\nuniform float zoom_y;\nuniform float aspect_ratio;\n\nconst vec3 VIEW_DIRECTION = vec3(0.0, -0.707, 0.707);",
      "water_sidescroll_2D_simple.gdshader": "shader_type canvas_item;\n\nuniform sampler2D transition_gradient :hint_default_black;\nuniform sampler2D distortion_map : hint_default_black;\n\nuniform vec4 water_tint :source_color;\n\nuniform vec2 distortion_scale = vec2(0.5, 0.5);\nuniform float distortion_amplitude :hint_range(0.005, 0.4) = 0.1;\nuniform float distortion_time_scale :hint_range(0.01, 0.15) = 0.05;\n\nuniform float water_time_scale :hint_range(0.01, 2.0) = 0.1;\nuniform float scale_y_factor :hint_range(0.1, 4.0) = 2.0;\nuniform float tile_factor :hint_range(0.1, 3.0) = 1.4;\n\nuniform float reflection_intensity :hint_range(0.01, 1.0) = 0.5;\n\n// Updated from GDScript\nuniform vec2 scale;\nuniform fl"
    }
  },
  {
    "name": "godot-stylized-liquid",
    "title": "GDQuest Stylized Container Liquid",
    "category": "Godot Water & Grass",
    "path": "godot/Shaders/stylized_liquid.gdshader",
    "files": {
      "stylized_liquid.gdshader": "// ANCHOR: all\nshader_type spatial;\nrender_mode cull_disabled,shadows_disabled;\n\nuniform float liquid_height = 0.5;\n// ANCHOR: surface_color\nuniform vec4 liquid_surface_color: source_color = vec4(0.7, 0.5, 1.0, 1.0);\n// END: surface_color\nuniform sampler2D liquid_rim_gradient: repeat_disable;\nuniform float rim_emission_intensity: hint_range(0.0, 2.0) = 0.2;\nuniform float rim_exponent: hint_range(1.0, 10.0) = 3.0;\nuniform float emission_intensity:hint_range(0.0, 3.0) = 0.1;\n// ANCHOR: gradient_size\nuniform float liquid_surface_gradient_size: hint_range(0.0, 3.0) = 0.1;\n// END: gradient_size\nuniform vec2 wobble = vec2(0.0, 0.0); \n// ANCHOR: varying\nvarying float y_coordinate;\n// END: varying\n// ANCHOR: rotate\nmat4 rotate_x(in float angle) {\n\treturn mat4(\n\t\t\tvec4(1.0,0.0,0.0,0.0),\n\t\t\tvec4(0.0,cos(angle),-sin(angle),0.0),\n\t\t\tvec4(0.0,sin(angle),cos(angle),0.0),\n\t\t\tvec4(0.0,0.0,0.0,1.0));\n}\n\nmat4 rotate_z(in float angle) {\n\treturn mat4(\n\t\t\tvec4(cos(angle),-sin(angle), 0.0, 0.0),\n\t\t\tvec4(sin(angle),cos(angle), 0.0, 0.0),\n\t\t\tvec4(0.0,0.0,1.0,0.0),\n\t\t\tvec4(0.0,0.0,0.0,1.0));\n}\n// END: rotate\nvoid vertex() {\n\t// Here is the part where most of the magic happens\n\t// we rotate the model on X and Z axis, and add an off"
    }
  },
  {
    "name": "godot-absorption-water",
    "title": "Absorption-Based Stylized Water (Beer Law)",
    "category": "Godot Water & Grass",
    "path": "https://godotshaders.com/shader/absorption-based-stylized-water/",
    "files": {
      "absorption_water.gdshader": "shader_type spatial;\nrender_mode shadows_disabled;\n\n#define CAUSTICS\n#define FRESNEL\n#define PLAYER_WAVES\n#define DISPLACEMENT\n#define SSR\n\ngroup_uniforms color;\nuniform vec3 absorption_color : source_color = vec3(1.0, 0.35, 0.0);\n#ifdef FRESNEL\nuniform float fresnel_radius : hint_range(0.0, 6.0, 0.01) = 2.0;\nuniform vec3 fresnel_color : source_color = vec3(0.0, 0.57, 0.72);\n#endif\nuniform float roughness : hint_range(0.0, 1.0, 0.01) = 0.15;\nuniform float specular : hint_range(0.0, 1.0, 0.01) = 0.25;\n// Depth adjustment\nuniform float depth_distance : hint_range(0.0, 50.0, 0.1) = 25.0;\nuniform float beers_law : hint_range(0.0, 20.0, 0.1) = 4.5;\n\n#ifdef DISPLACEMENT\ngroup_uniforms displacement;\nuniform float displacement_strength : hint_range(0.0, 5.0, 0.1) = 0.3;\nuniform float displacement_scroll_speed : hint_range(0.0, 1.0, 0.001) = 0.1;\nuniform vec2 displacement_scroll_offset = vec2 (-0.2, 0.3);\nuniform float displacement_scale_offset = 0.5;\nuniform vec2 displacement_scale = vec2(0.04);\nuniform sampler2D displacement_texture : hint_default_black, repeat_enable;\n#endif\n\ngroup_uniforms edge;\nuniform float edge_thickness : hint_range(0.0, 1.0, 0.001) = 0.3;\nuniform float edge_speed : hint_range(0.0, 1.0, 0.001) = 0.35;\nuniform vec2 edge_noise_scale = vec2(0.4);\nuniform sampler2D edge_noise : repeat_enable;\nuniform sampler2D edge_ramp : repeat_disable;\n\n#ifdef PLAYER_WAVES\ngroup_uniforms player;\nuniform float influence_size : hint_range(0.0, 4.0, 0.1) = 1.0;\nuniform float player_wave_frequenzy : hint_range(0.0, 20.0, 0.1) = 10.0;\nuniform float player_wave_speed : hint_range(0.0, 10.0, 0.1) = 5.0;\n#endif\n\n#ifdef CAUSTICS\ngroup_uniforms caustics;\nuniform float caustic_size : hint_range(0.0, 8.0, 0.01) = 2.0;\nuniform float caustic_range : hint_range(0.0, 256.0, 0.1) = 40.0;\nuniform float caustic_strength : hint_range(0.0, 1.0, 0.01) = 0.08;\n#endif\n\n#ifdef SSR\ngroup_uniforms screen_space_reflections;\nuniform float ssr_mix_strength : hint_range(0.0, 1.0, 0.01) = 0.65;\nuniform float ssr_travel : hint_range(0.0, 300.0, 0.5) = 100.0;\nuniform float ssr_resolution_near : hint_range(0.1, 10.0, 0.1) = 1.0;\nuniform float ssr_resolution_far : hint_range(2.0, 20.0, 0.1) = 5.0;\nuniform float ssr_tolerance : hint_range(0.0, 2.0, 0.01) = 1.0;\n#endif\n\ngroup_uniforms normal_map;\nuniform float refraction_strength : hint_range(0.0, 4.0, 0.01) = 1.25;\nuniform float normal_map_strength : hint_range(0.0, 4.0, 0.01) = 1.0;\nuniform float scroll_speed : hint_range(0.0, 1.0, 0.01) = 0.3;\nuniform vec2 scroll_offset = vec2(0.1, -0.3);\nuniform float scale_offset = 0.5;\nuniform vec2 normal_map_scale = vec2(0.1);\nuniform sampler2D normal_map : hint_normal, filter_linear_mipmap;\n\n// Hidden Uniforms\nglobal uniform float wind_intensity; // Global shader parameter between 0.0 and 1.0\nglobal uniform vec3 wind_direction;\n#ifdef PLAYER_WAVES\nglobal uniform vec3 player_position;\n#endif\nuniform sampler2D screen_texture: hint_screen_texture, filter_linear_mipmap, repeat_disable;\nuniform sampler2D depth_texture: hint_depth_texture, filter_linear_mipmap, repeat_disable;\n\nvarying vec3 global_position;\n\n#ifdef CAUSTICS\n// Permutation polynomial hash credit Stefan Gustavson\nvec4 permute(vec4 t) {\n    return t * (t * 34.0 + 133.0);\n}\n\n// Gradient set is a normalized expanded rhombic dodecahedron\nvec3 grad(float hash) {\n\n    // Random vertex of a cube, +/- 1 each\n    vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;\n\n    // Random edge of the three edges connected to that vertex\n    // Also a cuboctahedral vertex\n    // And corresponds to the face of its dual, the rhombic dodecahedron\n    vec3 cuboct = cube;\n    cuboct[int(hash / 16.0)] = 0.0;\n\n    // In a funky way, pick one of the four points on the rhombic face\n    float type = mod(floor(hash / 8.0), 2.0);\n    vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));\n\n    // Expand it so that the new edges are the same length\n    // as the existing ones\n    vec3 grad = fma(cuboct, vec3(1.22474487139), rhomb);\n\n    // To make all gradients the same length, we only need to shorten the\n    // second type of vector. We also put in the whole noise scale constant.\n    // The compiler should reduce it into the existing floats. I think.\n    grad *= fma(-0.042942436724648037, type, 1.0) * 3.5946317686139184;\n\n    return grad;\n}\n\n// BCC lattice split up into 2 cube lattices\nvec4 os2NoiseWithDerivativesPart(vec3 X) {\n    vec3 b = floor(X);\n    vec4 i4 = vec4(X - b, 2.5);\n\n    // Pick between each pair of oppposite corners in the cube.\n    vec3 v1 = b + floor(dot(i4, vec4(.25)));\n    vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35)));\n    vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35)));\n    vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35)));\n\n    // Gradient hashes for the four vertices in this half-lattice.\n    vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0));\n    hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0));\n    hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0);\n\n    // Gradient extrapolations & kernel function\n    vec3 d1 = X - v1; vec3 d2 = X - v2; vec3 d3 = X - v3; vec3 d4 = X - v4;\n    vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0);\n    vec4 aa = a * a; vec4 aaaa = aa * aa;\n    vec3 g1 = grad(hashes.x); vec3 g2 = grad(hashes.y);\n    vec3 g3 = grad(hashes.z); vec3 g4 = grad(hashes.w);\n    vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4));\n\n    // Derivatives of the noise\n    vec4 derivative = -8.0 * mat4(vec4(d1,0.), vec4(d2,0.), vec4(d3,0.), vec4(d4,0.)) * (aa * a * extrapolations)\n        + mat4(vec4(g1, 0.), vec4(g2, 0.), vec4(g3, 0.), vec4(g4, 0.)) * aaaa;\n\n    // Return it all as a vec4\n    return vec4(derivative.xyz, dot(aaaa, extrapolations));\n}\n\n// Rotates domain, but preserve shape. Hides grid better in cardinal slices.\n// Good for texturing 3D objects with lots of flat parts along cardinal planes.\nvec4 os2NoiseWithDerivatives_Fallback(vec3 X) {\n    X = dot(X, vec3(2.0/3.0)) - X;\n\n    vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);\n\n    return vec4(dot(result.xyz, vec3(2.0/3.0)) - result.xyz, result.w);\n}\n#endif\n\n#ifdef FRESNEL\nfloat fresnel(vec3 normal, vec3 view) {\n\treturn pow((1.0 - clamp(dot(normalize(normal), normalize(view)), 0.0, 1.0 )), fresnel_radius);\n}\n#endif\n\n\nvec2 refract_uv(inout vec2 uv, vec3 normal, float depth){\n\tfloat strength1 = refraction_strength * depth;\n\tuv += fma(strength1, length(normal), strength1 * -1.2);\n\treturn uv;\n}\n\n#ifdef SSR\nvec2 get_uv_from_view_position(vec3 position_view_space, mat4 proj_m)\n{\n\tvec4 position_clip_space = proj_m * vec4(position_view_space.xyz, 1.0);\n\tvec2 position_ndc = position_clip_space.xy / position_clip_space.w;\n\treturn position_ndc.xy * 0.5 + 0.5;\n}\n\nvec3 get_view_position_from_uv(vec2 uv, float depth, mat4 inv_proj_m)\n{\n\tvec4 position_ndc = vec4((uv * 2.0) - 1.0, depth, 1.0);\n\tvec4 view_position = inv_proj_m * position_ndc;\n\treturn view_position.xyz /= view_position.w;\n}\n#endif\n\nbool in_bounds(vec2 uv) {\n\tvec2 fruv = abs(floor(uv));\n\treturn fruv.x + fruv.y < 0.1;\n}\n\n\nvoid vertex() {\n\tglobal_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;\n\n\t#ifdef DISPLACEMENT\n\tfloat time = TIME * displacement_scroll_speed * fma(wind_intensity, 0.7, 0.3);\n\tfloat displace1 = texture(displacement_texture, fma(global_position.xz, displacement_scale, time * -wind_direction.xz)).r;\n\tfloat displace2 = texture(displacement_texture, fma(global_position.xz, displacement_scale * displacement_scale_offset, time * (-wind_direction.xz + displacement_scroll_offset))).r;\n\tfloat displacement_mixed = mix(displace1, displace2, 0.4);\n\tfloat offset = fma(displacement_mixed, 2.0, -1.0) * displacement_strength;\n\tVERTEX.y += offset;\n\tglobal_position.y += offset;\n\t#endif\n}\n\n\nvoid fragment() {\n\tvec3 opposing_color = vec3(1.0) - absorption_color.rgb;\n\tvec3 normalized_wind_direction = normalize(wind_direction);\n\tfloat wind_intens_factor = fma(wind_intensity, 0.7, 0.3);\n\t#ifdef FRESNEL\n\tfloat fresnel_value = fresnel(NORMAL, VIEW);\n\t#endif\n\n\tfloat time_factor = TIME * scroll_speed * wind_intens_factor;\n\tvec3 n1 = textureLod(normal_map, fma(global_position.xz, normal_map_scale, time_factor * -normalized_wind_direction.xz), 2.0).xyz;\n\tvec3 n2 = textureLod(normal_map, fma(global_position.xz, normal_map_scale * scale_offset, time_factor * 0.8 * (-normalized_wind_direction.xz + scroll_offset)), 2.0).xyz;\n\tNORMAL_MAP = mix(n1, n2, 0.5);\n\tNORMAL_MAP_DEPTH = normal_map_strength;\n\n\tfloat depth_tex = texture(depth_texture, SCREEN_UV).r;\n\n\tvec3 ndc = vec3(fma(SCREEN_UV, vec2(2.0), vec2(-1.0)), depth_tex);\n\tvec4 world = INV_VIEW_MATRIX * INV_PROJECTION_MATRIX * vec4(ndc, 1.0);\n\tworld.y /= world.w;\n\tfloat vertey_y = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).y;\n\tfloat relative_depth = vertey_y - world.y;\n\n\n\t// Create Edge caused by other Objects\n\tfloat edge_blend = clamp(relative_depth / -edge_thickness + 1.0, 0.0, 1.0);\n\tvec2 edge_noise_uv = global_position.xz * edge_noise_scale * fma(normalized_wind_direction.xz, vec2(0.5), vec2(0.5));\n\tedge_noise_uv = fma(-normalized_wind_direction.xz * TIME * edge_speed, vec2(wind_intens_factor), edge_noise_uv);\n\tfloat edge_noise_sample = texture(edge_noise, edge_noise_uv).r;\n\tfloat edge_mask = normalize( texture(edge_ramp, vec2(edge_noise_sample * fma(edge_blend, -1., 1.))).r);\n\n\t// Create Ripples caused by player\n\tfloat player_effect_mask = 0.0;\n\t#ifdef PLAYER_WAVES\n\tvec3 player_relative = vec3(global_position - player_position);\n\tfloat player_height = smoothstep(1.0, 0.0, abs(player_relative.y));\n\tfloat player_position_factor = smoothstep(influence_size, 0.0, length(player_relative.xz));\n\tfloat player_waves = pow( fma( sin(fma(player_position_factor, player_wave_frequenzy, TIME * player_wave_speed)), 0.5, 0.5), 6.0);\n\tfloat wave_distort = texture( edge_ramp, vec2( player_waves * (edge_noise_sample + 0.2) * player_position_factor * player_height)).x;\n\tplayer_effect_mask = clamp(normalize( fma(wave_distort, -1.0, 0.4)), 0.0, 1.0);\n\t#endif\n\n\t// combine Edge Mask with Player Ripples\n\tfloat ripple_mask = clamp( fma( edge_mask, edge_blend, player_effect_mask), 0.0, 1.0);\n\n\t// Calculate Fragment Depth\n\tvec4 clip_pos = PROJECTION_MATRIX * vec4(VERTEX, 1.0);\n\tclip_pos.xyz /= clip_pos.w;\n\tDEPTH = clip_pos.z;\n\t// Refract UV\n\tvec2 refracted_uv = SCREEN_UV;\n\trefract_uv(refracted_uv, NORMAL_MAP, sqrt(DEPTH) * relative_depth);\n\n\tvec3 screen;\n\tfloat depth_blend;\n\tfloat refracted_depth_tex = texture(depth_texture, refracted_uv).x;\n\tndc = vec3(fma(refracted_uv, vec2(2.0), vec2(-1.0)), refracted_depth_tex);\n\tworld = INV_VIEW_MATRIX * INV_PROJECTION_MATRIX * vec4(ndc, 1.0);\n\tworld.xyz /= world.w;\n\tfloat depth_test = vertey_y - world.y;\n\n\t// Caustic Effects\n\t#ifdef CAUSTICS\n\tfloat range_mod = clamp((VERTEX.z + caustic_range) * 0.05, 0.0, 1.0);\n\tfloat caustic_value = 0.0;\n\t// Protect yourself from calculating Noise at runtime with this handy if statement!\n\tif (range_mod > 0.0) {\n\t\tvec3 X = vec3(world.xz * caustic_size, mod(TIME, 578.0) * 0.8660254037844386);\n\t\tvec4 noiseResult = os2NoiseWithDerivatives_Fallback(X);\n\t\tnoiseResult = os2NoiseWithDerivatives_Fallback(X - noiseResult.xyz / 16.0);\n\t\tcaustic_value = fma(noiseResult.w, 0.5, 0.5) * range_mod * range_mod;\n\t}\n\t#endif\n\n\t/*\n\tSometimes the Water Refraction would cause the sampling of a screen position that is either\n\toutside the screen bounds or where another object is infront of the water.\n\tSwitching back to the unrefracted SCREEN_UV fixes that.\n\t*/\n\n\tif (depth_test > -0.0001 && in_bounds(refracted_uv)) {\n\t\tscreen = texture(screen_texture, refracted_uv).rgb * 0.9;\n\t\tdepth_blend = clamp(depth_test / depth_distance, 0.0, 1.0);\n\t\tdepth_blend = fma(exp(-depth_blend * beers_law), -1.0, 1.0);\n\t} else {\n\t\tscreen = texture(screen_texture, SCREEN_UV).rgb * 0.9;\n\t\tdepth_blend = clamp(relative_depth / depth_distance, 0.0, 1.0);\n\t\tdepth_blend = fma(exp(-depth_blend * beers_law), -1.0, 1.0);\n\t}\n\n\t#ifdef SSR\n\tvec3 view_normal_map = mat3(VIEW_MATRIX) * (vec3(NORMAL_MAP.x, 0.0, NORMAL_MAP.y) * 2.0 - 1.0);\n\tvec3 combined_normal = normalize(view_normal_map * (NORMAL_MAP_DEPTH * 0.15) + NORMAL);\n\tvec3 reflacted_path = reflect(-VIEW, combined_normal);\n\n\tvec2 current_screen_pos = vec2(0.0);\n\tvec3 current_view_pos = VERTEX;\n\tvec3 sampled_color = vec3(-1.0);\n\tfloat current_stepD = 0.0;\n\tfloat current_depth = 0.0;\n\tfloat alpha_hit = 0.0;\n\tfor(float i = 0.01; i < ssr_travel; i++) {\n\t\tcurrent_stepD = mix(ssr_resolution_near, ssr_resolution_far,float(i) / float(ssr_travel));\n\t\tcurrent_view_pos += reflacted_path * current_stepD;\n\t\tcurrent_screen_pos = get_uv_from_view_position(current_view_pos, PROJECTION_MATRIX);\n\t\tif (!in_bounds(current_screen_pos)) {break;}\n\t\tcurrent_depth = get_view_position_from_uv(current_screen_pos, texture(depth_texture, current_screen_pos).x, INV_PROJECTION_MATRIX).z - current_view_pos.z;\n\n\t\tif (current_depth > -0.0001 && current_depth <= ssr_tolerance * current_stepD) {\n\t\t\tsampled_color = textureLod(screen_texture, current_screen_pos, 0.5).rgb;\n\t\t\tvec2 ruv = 1.0 - abs(current_screen_pos * 2.0 - 1.0);\n\t\t\truv = pow(ruv, vec2(0.5));\n\t\t\talpha_hit = clamp(min(ruv.x, ruv.y), 0.0, 1.0);\n\t\t\tbreak;\n\t\t}\n\t\ti += current_stepD;\n\t}\n\t#endif\n\n\tvec3 color = clamp(screen - absorption_color.rgb * depth_blend, vec3(0.0), vec3(1.0)); // Absorb Screen Color\n\tcolor = mix(color, opposing_color, depth_blend*depth_blend); // Apply depth color\n\t#ifdef FRESNEL\n\tcolor = mix(color, fresnel_color, fresnel_value); // Apply fresnel color\n\t#endif\n\t#ifdef CAUSTICS\n\tcolor = clamp(color + caustic_value * caustic_strength * (1.0 - depth_blend), vec3(0.0), vec3(1.0));\n\t#endif\n\t#ifdef SSR\n\tcolor = mix(color, sampled_color, alpha_hit * (1.0 - roughness) * ssr_mix_strength);\n\t#endif\n\tcolor = mix(color, vec3(0.98), ripple_mask); // Apply Ripples\n\tALBEDO = color;\n\tROUGHNESS = roughness;\n\tSPECULAR = specular;\n}"
    }
  },
  {
    "name": "godot-stylized-toon-water",
    "title": "Stylized Toon Water (Ghibli Contour)",
    "category": "Godot Water & Grass",
    "path": "https://godotshaders.com/shader/stylized-toon-water/",
    "files": {
      "stylized_toon_water.gdshader": "shader_type spatial;\nrender_mode cull_disabled, blend_add, unshaded;\nuniform float time_speed = 1.0;\n//time specifically for the wave noise texture\nuniform float surface_speed = 1.0;\nuniform float spin = 0.0; //Twisting motion of the water\nuniform float brightness = 0.6;\nuniform float color_intensity = 0.0;\n//Tiling frequency of the noise accross the mesh\nuniform float horizontal_frequency = 2.0;\nuniform float vertical_frequency = 2.0;\n//overall size muliplier\nuniform float size = 3.0;\n//affects total size\nuniform float banding_bias = 0.6;\n\nuniform sampler2D wave_texture;\nuniform sampler2D noise_texture;\n//wave height, use for ocean waves\nuniform float wave_height = 0.5;\n//water surface height variation based on the noise texture\nuniform float texture_height = 0.5;\n//preset band colors\nuniform vec4 color1 : source_color = vec4(0.59, 0.761, 1.0, 1.0);\nuniform vec4 color2 : source_color = vec4(0.274, 0.474, 0.98, 1.0);\nuniform vec4 color3 : source_color = vec4(0.059, 0.389, 0.85, 1.0);\nuniform vec4 color4 : source_color = vec4(0.0, 0.267, 1.0, 1.0);\n\nvoid vertex() {\n\tfloat time = -TIME * time_speed;\n\tVERTEX += NORMAL * wave_height * texture(wave_texture, vec2(UV.x + time * surface_speed, UV.y + time * surface_speed)).r;\n\tVERTEX += NORMAL * texture_height * texture(noise_texture,vec2(UV.x * horizontal_frequency + spin * (time /2.0), (UV.y * vertical_frequency) + time)).r;;\n}\n\nvoid fragment() {\n\tfloat time = -TIME * time_speed;\n\n// Calculate dot product of normals and combine with noise texture value\n\tfloat normal_facing = dot(NORMAL, VIEW);\n\tfloat noise_value = texture(noise_texture,vec2(UV.x * horizontal_frequency + spin * (time /2.0), (UV.y * vertical_frequency) + time)).r;\n\tnormal_facing += (noise_value -0.5 + size) * 0.3;\n\n\tfloat band = normal_facing * 3.0 * banding_bias;\n\tvec4 band_color = vec4(0,0,0,0);\n\tif (band <= 1.5) {\n\t\tdiscard;\n\t}\n\telse if(band <= 2.0){\n\t\tband_color = mix(color1, color2, -0.01 / (band-2.01)); //Mixes the color bands to make a slight gradient\n\t}\n\telse if (band <= 2.5) {\n\t\tband_color = mix(color2, color3, -0.01 / (band-2.51));\n\t}\n\telse if (band <= 2.9) {\n\t\tband_color = mix(color3, color4, -0.01 / (band-2.91));\n\t}\n\telse if (band >= 0.0) {\n\t\tband_color = color4;\n\t}\n\t//Final color adjestment\n\tALBEDO = clamp(brightness * (vec3(1.0, 1.0, 1.0) - (band_color.xyz * -color_intensity)) * band_color.xyz, vec3(0.0, 0.0, 0.0), vec3(brightness, brightness, brightness));\n}"
    }
  },
  {
    "name": "godot-realistic-water",
    "title": "Realistic Gerstner Ocean (AiYori)",
    "category": "Godot Water & Grass",
    "path": "https://godotshaders.com/shader/realistic-water/",
    "files": {
      "realistic_water.gdshader": "/*\nRealistic Water Shader for Godot 3.4 \nModified to work with Godot 3.4 with thanks to jmarceno.\nCopyright (c) 2019 UnionBytes, Achim Menzel (alias AiYori)\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n-- UnionBytes \n-- YouTube: www.youtube.com/user/UnionBytes\n*/\n\n\n// For this shader min. GODOT 3.1.1 is required, because 3.1 has a depth buffer bug!\nshader_type \tspatial;\nrender_mode \tcull_back,diffuse_burley,specular_schlick_ggx, blend_mix;\n\n\n// Wave settings:\nuniform float\twave_speed\t\t = 0.5; // Speed scale for the waves\nuniform vec4\twave_a\t\t\t = vec4(1.0, 1.0, 0.35, 3.0); \t// xy = Direction, z = Steepness, w = Length\nuniform\tvec4\twave_b\t\t\t = vec4(1.0, 0.6, 0.30, 1.55);\t// xy = Direction, z = Steepness, w = Length\nuniform\tvec4\twave_c\t\t\t = vec4(1.0, 1.3, 0.25, 0.9); \t// xy = Direction, z = Steepness, w = Length\n\n// Surface settings:\nuniform vec2 \tsampler_scale \t = vec2(0.25, 0.25); \t\t\t// Scale for the sampler\nuniform vec2\tsampler_direction= vec2(0.05, 0.04); \t\t\t// Direction and speed for the sampler offset\n\nuniform sampler2D uv_sampler : hint_aniso; \t\t\t\t\t\t// UV motion sampler for shifting the normalmap\nuniform vec2 \tuv_sampler_scale = vec2(0.25, 0.25); \t\t\t// UV sampler scale\nuniform float \tuv_sampler_strength = 0.04; \t\t\t\t\t// UV shifting strength\n\nuniform sampler2D normalmap_a_sampler : hint_normal;\t\t\t// Normalmap sampler A\nuniform sampler2D normalmap_b_sampler : hint_normal;\t\t\t// Normalmap sampler B\n\nuniform sampler2D foam_sampler : hint_black;\t\t\t\t\t// Foam sampler\nuniform float \tfoam_level \t\t = 0.5;\t\t\t\t\t\t\t// Foam level -> distance from the object (0.0 - 0.5)\n\n// Volume settings:\nuniform float \trefraction \t\t = 0.075;\t\t\t\t\t\t// Refraction of the water\n\nuniform vec4 \tcolor_deep : hint_color;\t\t\t\t\t\t// Color for deep places in the water, medium to dark blue\nuniform vec4 \tcolor_shallow : hint_color;\t\t\t\t\t\t// Color for lower places in the water, bright blue - green\nuniform float \tbeers_law\t\t = 2.0;\t\t\t\t\t\t\t// Beers law value, regulates the blending size to the deep water level\nuniform float \tdepth_offset\t = -0.75;\t\t\t\t\t\t// Offset for the blending\n\n// Projector for the water caustics:\nuniform mat4\tprojector;\t\t\t\t\t\t\t\t\t\t// Projector matrix, mostly the matric of the sun / directlight\nuniform sampler2DArray caustic_sampler : hint_black;\t\t\t// Caustic sampler, (Texture array with 16 Textures for the animation)\n\n\n// Vertex -> Fragment:\nvarying float \tvertex_height;\t\t\t\t\t\t\t\t\t// Height of the water surface\nvarying vec3 \tvertex_normal;\t\t\t\t\t\t\t\t\t// Vertex normal -> Needed for refraction calculation\nvarying vec3 \tvertex_binormal;\t\t\t\t\t\t\t\t// Vertex binormal -> Needed for refraction calculation\nvarying vec3 \tvertex_tangent;\t\t\t\t\t\t\t\t\t// Vertex tangent -> Needed for refraction calculation\n\nvarying mat4 \tinv_mvp; \t\t\t\t\t\t\t\t\t\t// Inverse ModelViewProjection matrix -> Needed for caustic projection\n\n \n// Wave function:\nvec4 wave(vec4 parameter, vec2 position, float time, inout vec3 tangent, inout vec3 binormal)\n{\n\tfloat\twave_steepness\t = parameter.z;\n\tfloat\twave_length\t\t = parameter.w;\n\n\tfloat\tk\t\t\t\t = 2.0 * 3.14159265359 / wave_length;\n\tfloat \tc \t\t\t\t = sqrt(9.8 / k);\n\tvec2\td\t\t\t\t = normalize(parameter.xy);\n\tfloat \tf \t\t\t\t = k * (dot(d, position) - c * time);\n\tfloat \ta\t\t\t\t = wave_steepness / k;\n\t\n\t\t\ttangent\t\t\t+= normalize(vec3(1.0-d.x * d.x * (wave_steepness * sin(f)), d.x * (wave_steepness * cos(f)), -d.x * d.y * (wave_steepness * sin(f))));\n\t\t\tbinormal\t\t+= normalize(vec3(-d.x * d.y * (wave_steepness * sin(f)), d.y * (wave_steepness * cos(f)), 1.0-d.y * d.y * (wave_steepness * sin(f))));\n\n\treturn vec4(d.x * (a * cos(f)), a * sin(f) * 0.25, d.y * (a * cos(f)), 0.0);\n}\n\n\n// Vertex shader:\nvoid vertex()\n{\n\tfloat\ttime\t\t\t = TIME * wave_speed;\n\t\n\tvec4\tvertex\t\t\t = vec4(VERTEX, 1.0);\n\tvec3\tvertex_position  = (WORLD_MATRIX * vertex).xyz;\n\t\n\tvec3 tang = vec3(0.0, 0.0, 0.0);\n\tvec3 bin = vec3(0.0, 0.0, 0.0);\n\t\n\tvertex \t\t\t+= wave(wave_a, vertex_position.xz, time, tang, bin);\n\tvertex \t\t\t+= wave(wave_b, vertex_position.xz, time, tang, bin);\n\tvertex \t\t\t+= wave(wave_c, vertex_position.xz, time, tang, bin);\n\n\tvertex_tangent \t = tang;\n\tvertex_binormal  = bin;\n\n\tvertex_position  = vertex.xyz;\n\n\tvertex_height\t = (PROJECTION_MATRIX * MODELVIEW_MATRIX * vertex).z;\n\n\tTANGENT\t\t\t = vertex_tangent;\n\tBINORMAL\t\t = vertex_binormal;\n\tvertex_normal\t = normalize(cross(vertex_binormal, vertex_tangent));\n\tNORMAL\t\t\t = vertex_normal;\n\n\tUV\t\t\t\t = vertex.xz * sampler_scale;\n\n\tVERTEX\t\t\t = vertex.xyz;\n\t\n\tinv_mvp = inverse(PROJECTION_MATRIX * MODELVIEW_MATRIX);\n}\n\n\n// Fragment shader:\nvoid fragment()\n{\n\t// Calculation of the UV with the UV motion sampler\n\tvec2\tuv_offset \t\t\t\t\t = sampler_direction * TIME;\n\tvec2 \tuv_sampler_uv \t\t\t\t = UV * uv_sampler_scale + uv_offset;\n\tvec2\tuv_sampler_uv_offset \t\t = uv_sampler_strength * texture(uv_sampler, uv_sampler_uv).rg * 2.0 - 1.0;\n\tvec2 \tuv \t\t\t\t\t\t\t = UV + uv_sampler_uv_offset;\n\t\n\t// Normalmap:\n\tvec3 \tnormalmap\t\t\t\t\t = texture(normalmap_a_sampler, uv - uv_offset*2.0).rgb * 0.75;\t\t// 75 % sampler A\n\t\t\tnormalmap \t\t\t\t\t+= texture(normalmap_b_sampler, uv + uv_offset).rgb * 0.25;\t\t\t// 25 % sampler B\n\t\n\t// Refraction UV:\n\tvec3\tref_normalmap\t\t\t\t = normalmap * 2.0 - 1.0;\n\t\t\tref_normalmap\t\t\t\t = normalize(vertex_tangent*ref_normalmap.x + vertex_binormal*ref_normalmap.y + vertex_normal*ref_normalmap.z);\n\tvec2 \tref_uv\t\t\t\t\t\t = SCREEN_UV + (ref_normalmap.xy * refraction) / vertex_height;\n\t\n\t// Ground depth:\n\tfloat \tdepth_raw\t\t\t\t\t = texture(DEPTH_TEXTURE, ref_uv).r * 2.0 - 1.0;\n\tfloat\tdepth\t\t\t\t\t\t = PROJECTION_MATRIX[3][2] / (depth_raw + PROJECTION_MATRIX[2][2]);\n\t\t\t\n\tfloat \tdepth_blend \t\t\t\t = exp((depth+VERTEX.z + depth_offset) * -beers_law);\n\t\t\tdepth_blend \t\t\t\t = clamp(1.0-depth_blend, 0.0, 1.0);\t\n\tfloat\tdepth_blend_pow\t\t\t\t = clamp(pow(depth_blend, 2.5), 0.0, 1.0);\n\n\t// Ground color:\n\tvec3 \tscreen_color \t\t\t\t = textureLod(SCREEN_TEXTURE, ref_uv, depth_blend_pow * 2.5).rgb;\n\t\n\tvec3 \tdye_color \t\t\t\t\t = mix(color_shallow.rgb, color_deep.rgb, depth_blend_pow);\n\tvec3\tcolor \t\t\t\t\t\t = mix(screen_color*dye_color, dye_color*0.25, depth_blend_pow*0.5);\n\t\n\t// Caustic screen projection\n\tvec4 \tcaustic_screenPos \t\t\t = vec4(ref_uv*2.0-1.0, depth_raw, 1.0);\n\tvec4 \tcaustic_localPos \t\t\t = inv_mvp * caustic_screenPos;\n\t\t\tcaustic_localPos\t\t\t = vec4(caustic_localPos.xyz/caustic_localPos.w, caustic_localPos.w);\n\t\n\tvec2 \tcaustic_Uv \t\t\t\t\t = caustic_localPos.xz / vec2(1024.0) + 0.5;\n\tvec4\tcaustic_color\t\t\t\t = texture(caustic_sampler, vec3(caustic_Uv*300.0, mod(TIME*14.0, 16.0)));\n\n\t\t\tcolor \t\t\t\t\t\t*= 1.0 + pow(caustic_color.r, 1.50) * (1.0-depth_blend) * 6.0;\n\n\t// Foam:\n\t\t\tif(depth + VERTEX.z < vertex_height-0.1)\n\t\t\t{\n\t\t\t\tfloat foam_noise = clamp(pow(texture(foam_sampler, (uv*4.0) - uv_offset).r, 10.0)*40.0, 0.0, 0.2);\n\t\t\t\tfloat foam_mix = clamp(pow((1.0-(depth + VERTEX.z) + foam_noise), 8.0) * foam_noise * 0.4, 0.0, 1.0);\n\t\t\t\tcolor = mix(color, vec3(1.0), foam_mix);\n\t\t\t}\n\t\n\t// Set all values:\n\tALBEDO = color;\n\tMETALLIC = 0.1;\n\tROUGHNESS = 0.2;\n\tSPECULAR = 0.2 + depth_blend_pow * 0.4;\n\tNORMALMAP = normalmap;\n\tNORMALMAP_DEPTH = 1.25;\n}"
    }
  },
  {
    "name": "godot-toon-water-roystan",
    "title": "Roystan Toon Water (Depth Edge Foam)",
    "category": "Godot Water & Grass",
    "path": "https://godotshaders.com/shader/toon-water-shader/",
    "files": {
      "toon_water.gdshader": "/**\n* Ported from the original unity shader by Erik Roystan Ross\n* https://roystan.net/articles/toon-water.html\n* https://github.com/IronWarrior/ToonWaterShader\n* Camera Depth taken from Bastiaan Olij's video on: https://www.youtube.com/watch?v=Jq3he9Lbj7M\n*/\n\nshader_type spatial;\n\nconst float SMOOTHSTEP_AA = 0.01;\n\nuniform sampler2D surfaceNoise;\nuniform sampler2D distortNoise;\n\nuniform float beer_factor = 0.8;\n\nuniform float foam_distance = 0.01;\nuniform float foam_max_distance = 0.4;\nuniform float foam_min_distance = 0.04;\nuniform vec4 foam_color: hint_color  = vec4(1.0);\n\nuniform vec2 surface_noise_tiling = vec2(1.0, 4.0);\nuniform vec3 surface_noise_scroll = vec3(0.03, 0.03, 0.0);\nuniform float surface_noise_cutoff: hint_range(0, 1) = 0.777;\nuniform float surface_distortion_amount: hint_range(0, 1) = 0.27;\n\nuniform vec4 _DepthGradientShallow: hint_color = vec4(0.325, 0.807, 0.971, 0.725);\nuniform vec4 _DepthGradientDeep: hint_color = vec4(0.086, 0.407, 1, 0.749);\nuniform float _DepthMaxDistance: hint_range(0, 1) = 1.0;\nuniform float _DepthFactor = 1.0;\n\nvarying vec2 noiseUV;\nvarying vec2 distortUV;\nvarying vec3 viewNormal;\n\nvec4 alphaBlend(vec4 top, vec4 bottom)\n{\n\tvec3 color = (top.rgb * top.a) + (bottom.rgb * (1.0 - top.a));\n\tfloat alpha = top.a + bottom.a * (1.0 - top.a);\n\t\n\treturn vec4(color, alpha);\n}\n\nvoid vertex() {\n\tviewNormal = (MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz;\n\tnoiseUV = UV * surface_noise_tiling;\n\tdistortUV = UV;\n}\n\nvoid fragment(){\n\t// https://www.youtube.com/watch?v=Jq3he9Lbj7M\n\tfloat depth = texture(DEPTH_TEXTURE, SCREEN_UV).r;\n\tdepth = depth * 2.0 - 1.0;\n\tdepth = PROJECTION_MATRIX[3][2] / (depth + PROJECTION_MATRIX[2][2]);\n\tdepth = depth + VERTEX.z;\n\tdepth = exp(-depth * beer_factor);\n\tdepth = 1.0 - depth;\n\t\n\t// Still unsure how to get properly the NORMAL from the camera\n\t// this was my best attempt\n\tvec3 existingNormal = vec3(dFdx(depth), dFdy(depth), 0);\n\t\n\tfloat normalDot = clamp(dot(existingNormal.xyz, viewNormal), 0.0, 1.0);\n\tfloat foamDistance = mix(foam_max_distance, foam_min_distance, normalDot);\n\t\n\tfloat foamDepth = clamp(depth / foamDistance, 0.0, 1.0);\n\tfloat surfaceNoiseCutoff = foamDepth * surface_noise_cutoff;\n\t\n\tvec4 distortNoiseSample = texture(distortNoise, distortUV);\n\tvec2 distortAmount = (distortNoiseSample.xy * 2.0 -1.0) * surface_distortion_amount;\n\t\n\tvec2 noise_uv = vec2(\n\t\t(noiseUV.x + TIME * surface_noise_scroll.x) + distortAmount.x , \n\t\t(noiseUV.y + TIME * surface_noise_scroll.y + distortAmount.y)\n\t);\n\tfloat surfaceNoiseSample = texture(surfaceNoise, noise_uv).r;\n\tfloat surfaceNoiseAmount = smoothstep(surfaceNoiseCutoff - SMOOTHSTEP_AA, surfaceNoiseCutoff + SMOOTHSTEP_AA, surfaceNoiseSample);\n\t\n\tfloat waterDepth = clamp(depth / _DepthMaxDistance, 0.0, 1.0) * _DepthFactor;\n\tvec4 waterColor = mix(_DepthGradientShallow, _DepthGradientDeep, waterDepth);\n\n\tvec4 surfaceNoiseColor = foam_color;\n    surfaceNoiseColor.a *= surfaceNoiseAmount;\n\tvec4 color = alphaBlend(surfaceNoiseColor, waterColor);\n\t\n\tALBEDO = color.rgb;\n\tALPHA = color.a;\n}"
    }
  },
  {
    "name": "godot-liquid-glass-ui",
    "title": "Liquid Glass UI (Refraction Dispersion)",
    "category": "Godot Water & Grass",
    "path": "https://godotshaders.com/shader/liquid-glass-ui-customizable/",
    "files": {
      "liquid_glass.gdshader": "shader_type canvas_item;\n\n// Liquid Glass UI Shader v2 - by sentinelcmd\n\nuniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;\n\nuniform float blur : hint_range(0.0, 8.0) = 3.5;\nuniform float warp_intensity : hint_range(0.0, 1.0) = 0.4;\nuniform float strength_x : hint_range(0.0, 50.0) = 12.0;\nuniform float strength_y : hint_range(0.0, 50.0) = 12.0;\nuniform float offset_x : hint_range(-1.0, 1.0) = 0.0;\nuniform float offset_y : hint_range(-1.0, 1.0) = 0.0;\n\nuniform float corner_radius : hint_range(0.0, 1.0) = 0.3;\nuniform float edge_smoothness : hint_range(0.5, 3.0) = 1.0;\n\nuniform vec4 tint : source_color = vec4(0.95, 0.97, 1.0, 0.12);\nuniform vec4 edge_highlight : source_color = vec4(1.0, 1.0, 1.0, 0.3);\nuniform float edge_width : hint_range(0.0, 10.0) = 1.5;\nuniform float chromatic_strength : hint_range(0.0, 5.0) = 5.0;\n\nfloat rounded_box(vec2 p, vec2 b, float r) {\n    vec2 q = abs(p) - b + r;\n    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;\n}\n\nvoid fragment() {\n    float dx = dFdx(UV.x);\n    float dy = dFdy(UV.y);\n\n    dx = sign(dx) * max(abs(dx), 0.0001);\n    dy = sign(dy) * max(abs(dy), 0.0001);\n\n    vec2 size = abs(vec2(1.0 / dx, 1.0 / dy));\n\n    size = clamp(size, vec2(1.0), vec2(4096.0));\n\n    vec2 half_size = size * 0.5;\n    vec2 pixel = UV * size;\n    vec2 centered = pixel - half_size;\n\n    float max_r = min(half_size.x, half_size.y);\n    float r = corner_radius * max_r;\n\n    float sdf = rounded_box(centered, half_size, r);\n    float alpha = 1.0 - smoothstep(-edge_smoothness, edge_smoothness, sdf);\n\n    if (alpha < 0.001) {\n        discard;\n    }\n\n    float max_dist = min(half_size.x, half_size.y) * 0.5;\n    float w = clamp(-sdf / max_dist, 0.0, 1.0);\n\n    vec2 uv_dir = length(centered) > 0.001 ? normalize(centered) : vec2(0.0, 1.0);\n\n    float exp_x = exp(-strength_x * pow(w + offset_x, 2.0));\n    float exp_y = exp(-strength_y * pow(w + offset_y, 2.0));\n    vec2 warp_offset = uv_dir * vec2(exp_x, exp_y) * warp_intensity / 10.0;\n    vec2 warped_uv = SCREEN_UV - warp_offset;\n\n    float edge_proximity = 1.0 - w;\n    vec2 chroma_offset = uv_dir * edge_proximity * chromatic_strength * SCREEN_PIXEL_SIZE;\n\n    float bg_r = textureLod(screen_texture, warped_uv - chroma_offset, blur).r;\n    float bg_g = textureLod(screen_texture, warped_uv, blur).g;\n    float bg_b = textureLod(screen_texture, warped_uv + chroma_offset, blur).b;\n    vec3 bg = vec3(bg_r, bg_g, bg_b);\n\n    vec3 color = mix(bg, tint.rgb, tint.a);\n\n    float edge = 1.0 - smoothstep(0.0, edge_width, -sdf);\n    edge *= step(sdf, 0.0);\n    color = mix(color, edge_highlight.rgb, edge * edge_highlight.a);\n\n    color += vec3(smoothstep(0.4, 0.0, UV.y) * 0.08 * w);\n\n    COLOR = vec4(color, alpha);\n}"
    }
  }
];
