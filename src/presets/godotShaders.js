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
