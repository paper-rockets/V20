import { DESKTOP_SHADERS_MATERIAL } from './desktopShaders';
import { GODOT_MATERIAL_PRESETS } from './godotShaders';
import { BLOBMIXER_MATERIAL_PRESETS } from './blobmixerShaders';
import { WAYFINDER_MATERIAL_PRESETS } from './wayfinderShaders';
import { GRASSWORKS_MATERIAL_PRESETS } from './grassworksShaders';
import { REZE_MATERIAL_PRESETS } from './rezeShaders';

// High-Quality Procedural MatCap Canvas Generator
function createMatCap(drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, 512, 512);
  return canvas.toDataURL('image/png');
}

// 1. SUMMER AFTERNOON SHADERS (Visual Presets with Real-Time Shaders)
export const SUMMER_SHADERS = [
  {
    id: 'summer_ocean_water',
    name: 'Summer Ocean Water',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Real-time animated ocean water with moving waves, Fresnel reflections, and foam blending.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#67e6dc');
      grad.addColorStop(0.55, '#0984e3');
      grad.addColorStop(0.85, '#074278');
      grad.addColorStop(1, '#021830');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.38, 0.2, 1.8);
      ctx.stroke();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;

void main() {
  v_uv = uv;
  vec3 pos = position;
  float wave = sin(pos.x * 4.0 + u_time * 2.5) * cos(pos.y * 4.0 + u_time * 2.0) * 0.12;
  pos += normal * wave;
  v_normal = normalize(normalMatrix * normal);
  v_position = (modelViewMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;

void main() {
  vec3 view_dir = normalize(-v_position);
  vec3 norm = normalize(v_normal);
  float wave_noise = sin(v_uv.x * 25.0 + u_time * 3.0) * cos(v_uv.y * 25.0 + u_time * 2.0);
  float fresnel = pow(1.0 - max(dot(view_dir, norm), 0.0), 2.5);
  vec3 deep_blue = vec3(0.04, 0.25, 0.55);
  vec3 turquoise = vec3(0.2, 0.8, 0.85);
  vec3 foam_white = vec3(0.95, 1.0, 1.0);
  vec3 col = mix(deep_blue, turquoise, fresnel + wave_noise * 0.15);
  float foam = step(0.65, fresnel + wave_noise * 0.2);
  col = mix(col, foam_white, foam * 0.85);
  gl_FragColor = vec4(col + vec3(fresnel * 0.4), 0.92);
}`
  },
  {
    id: 'summer_skydome_sunset',
    name: 'Summer Golden Sunset',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Atmospheric golden hour sky gradient with sun glow and Rayleigh color scattering.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2d98da');
      grad.addColorStop(0.35, '#82ccdd');
      grad.addColorStop(0.65, '#f8c291');
      grad.addColorStop(0.85, '#e55039');
      grad.addColorStop(1.0, '#4a1010');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      const sun = ctx.createRadialGradient(w * 0.5, h * 0.65, 0, w * 0.5, h * 0.65, w * 0.25);
      sun.addColorStop(0, '#ffffff');
      sun.addColorStop(0.4, '#ffeaa7');
      sun.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  v_normal = normalize(normalMatrix * normal);
  v_position = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  float y = normalize(v_position).y * 0.5 + 0.5;
  vec3 sky_top = vec3(0.15, 0.45, 0.85);
  vec3 sky_horizon = vec3(0.98, 0.65, 0.35);
  vec3 sky_sunset = vec3(0.95, 0.25, 0.15);
  vec3 col = mix(sky_sunset, sky_horizon, smoothstep(0.0, 0.45, y));
  col = mix(col, sky_top, smoothstep(0.45, 1.0, y));
  float sun = max(dot(v_normal, normalize(vec3(0.6, 0.4, 0.8))), 0.0);
  col += vec3(pow(sun, 16.0) * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_wind_foliage',
    name: 'Summer Wind & Foliage',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Swaying wind vertex displacement with lush foliage tones and subsurface scattering.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#f1f2f6');
      grad.addColorStop(0.25, '#7bed9f');
      grad.addColorStop(0.6, '#2ed573');
      grad.addColorStop(0.85, '#1e824c');
      grad.addColorStop(1, '#0e4424');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  vec3 pos = position;
  float wind = sin(pos.y * 3.0 + u_time * 3.5) * 0.12 * smoothstep(-1.0, 1.0, pos.y);
  pos.x += wind;
  pos.z += wind * 0.5;
  v_normal = normalize(normalMatrix * normal);
  v_position = (modelViewMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  vec3 light_dir = normalize(vec3(0.8, 1.0, 0.6));
  float diff = max(dot(v_normal, light_dir), 0.0);
  vec3 shadow_green = vec3(0.08, 0.32, 0.16);
  vec3 leaf_green = vec3(0.24, 0.78, 0.38);
  vec3 sunlit_lime = vec3(0.72, 0.95, 0.42);
  vec3 col = mix(shadow_green, leaf_green, diff);
  col = mix(col, sunlit_lime, pow(diff, 3.0) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_drifting_clouds',
    name: 'Summer Fluffy Clouds',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Drifting volumetric cloud procedural noise with warm afternoon light.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, '#f1f2f6');
      grad.addColorStop(0.7, '#ced6e0');
      grad.addColorStop(0.9, '#a4b0be');
      grad.addColorStop(1, '#57606f');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;

void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec2 v_uv;

void main() {
  vec2 uv = v_uv * 4.0;
  float n1 = sin(uv.x * 4.0 + u_time * 0.8) * cos(uv.y * 4.0 + u_time * 0.5);
  float n2 = sin(uv.x * 8.0 - u_time * 1.2) * cos(uv.y * 8.0 + u_time * 0.9) * 0.5;
  float density = smoothstep(-0.2, 0.8, n1 + n2);
  vec3 cloud_shadow = vec3(0.65, 0.72, 0.82);
  vec3 cloud_sun = vec3(1.0, 0.97, 0.92);
  vec3 col = mix(cloud_shadow, cloud_sun, density);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_phong_terrain',
    name: 'Summer Terrain & Road',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Sandy beach terrain with procedural rock patches, distance fog, and sun-warmed surface normals.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.6,h*.38,8,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#f5e4c0'); grad.addColorStop(.45,'#d4b87a'); grad.addColorStop(.8,'#a08050'); grad.addColorStop(1,'#5c3d18');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_pos;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_pos = position;
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_pos;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
void main() {
  vec3 light = normalize(vec3(0.8, 1.0, 0.6));
  float diff = max(dot(v_normal, light), 0.0);
  float n = noise(v_uv * 8.0);
  float n2 = noise(v_uv * 22.0 + 3.7);
  vec3 sand = vec3(0.88, 0.75, 0.52);
  vec3 rock = vec3(0.55, 0.48, 0.38);
  vec3 col = mix(sand, rock, smoothstep(0.45, 0.65, n));
  col = mix(col * 0.72, col, diff + n2 * 0.15);
  col += vec3(0.18, 0.12, 0.0) * pow(diff, 4.0);
  float fog = smoothstep(0.3, 1.0, length(v_pos) * 0.4);
  col = mix(col, vec3(0.85, 0.90, 0.95), fog * 0.3);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_phong_foliage_trees',
    name: 'Summer Palm Tree Foliage',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Wind-swaying tropical foliage with subsurface scatter rim light and multi-harmonic sine vertex displacement.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.6,h*.4,10,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#d4f5c0'); grad.addColorStop(.4,'#5ab843'); grad.addColorStop(.85,'#2d7a1f'); grad.addColorStop(1,'#1a4a10');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_pos;
void main() {
  vec3 pos = position;
  float h = smoothstep(-1.0, 1.0, pos.y);
  pos.x += sin(pos.x * 2.5 + u_time * 2.8) * 0.10 * h;
  pos.z += sin(pos.z * 3.1 + u_time * 1.9 + 1.2) * 0.07 * h;
  v_normal = normalize(normalMatrix * normal);
  v_pos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_pos;
void main() {
  vec3 light = normalize(vec3(1.0, 1.2, 0.8));
  float diff = max(dot(v_normal, light), 0.0);
  float sss = pow(max(dot(-v_normal, light), 0.0), 3.0) * 0.35;
  vec3 dark = vec3(0.07, 0.28, 0.10);
  vec3 mid  = vec3(0.20, 0.65, 0.22);
  vec3 lime = vec3(0.60, 0.90, 0.25);
  vec3 col = mix(dark, mid, diff);
  col = mix(col, lime, pow(diff, 3.0) * 0.55);
  col += vec3(0.55, 0.95, 0.30) * sss;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_phong_rocks',
    name: 'Summer Rock & Stone',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Weathered rock material with procedural noise variation and Blinn-Phong specular highlights.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.6,h*.35,5,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#d6cfc7'); grad.addColorStop(.5,'#a89880'); grad.addColorStop(1,'#5c4a38');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
void main() {
  vec3 sun = normalize(vec3(1.0, 1.3, 0.7));
  float diff = max(dot(v_normal, sun), 0.0);
  float n1 = noise(v_uv * 6.0);
  float n2 = noise(v_uv * 18.0 + 5.1);
  vec3 light_rock = vec3(0.78, 0.70, 0.60);
  vec3 dark_rock  = vec3(0.38, 0.33, 0.27);
  vec3 col = mix(dark_rock, light_rock, n1 * 0.6 + diff * 0.4);
  col += n2 * 0.08;
  vec3 h = normalize(sun + vec3(0,0,1));
  float spec = pow(max(dot(v_normal, h), 0.0), 32.0);
  col += vec3(0.95, 0.85, 0.65) * spec * 0.15;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_phong_characters',
    name: 'Summer Characters Skinned',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Warm skin-toned character shader with subsurface scatter bloom and soft rim lighting.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.62,h*.38,8,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#fce8d8'); grad.addColorStop(.35,'#e8a87c'); grad.addColorStop(.7,'#c4714a'); grad.addColorStop(1,'#7a3820');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_normal = normalize(normalMatrix * normal);
  v_view = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view;
void main() {
  vec3 sun = normalize(vec3(0.8, 1.0, 0.6));
  float diff = max(dot(v_normal, sun), 0.0);
  float sss = pow(max(dot(-v_normal, sun), 0.0), 2.5) * 0.4;
  float rim = pow(1.0 - max(dot(v_view, v_normal), 0.0), 3.0);
  vec3 shadow = vec3(0.65, 0.33, 0.18);
  vec3 mid    = vec3(0.90, 0.62, 0.42);
  vec3 lit    = vec3(1.0,  0.85, 0.68);
  vec3 col = mix(shadow, mid, diff);
  col = mix(col, lit, pow(diff, 4.0) * 0.5);
  col += vec3(0.98, 0.40, 0.28) * sss;
  col += vec3(1.0, 0.85, 0.55) * rim * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_phong_props',
    name: 'Summer Props & Machinery',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Metallic prop shader: Blinn-Phong specular, environment rim, and warm golden highlight tint.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.65,h*.35,5,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#f0f0f0'); grad.addColorStop(.3,'#adb5c0'); grad.addColorStop(.7,'#6c7a88'); grad.addColorStop(1,'#2c3440');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_normal = normalize(normalMatrix * normal);
  v_view = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view;
void main() {
  vec3 sun = normalize(vec3(1.0, 1.2, 0.7));
  float diff = max(dot(v_normal, sun), 0.0);
  vec3 h = normalize(sun + v_view);
  float spec = pow(max(dot(v_normal, h), 0.0), 64.0);
  float rim = pow(1.0 - max(dot(v_view, v_normal), 0.0), 2.5);
  vec3 base = vec3(0.55, 0.60, 0.65);
  vec3 dark = vec3(0.18, 0.20, 0.24);
  vec3 col = mix(dark, base, diff * 0.8 + 0.2);
  col += vec3(1.0, 0.88, 0.60) * spec * 0.6;
  col += vec3(0.7, 0.85, 1.0) * rim * 0.15;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_ocean_water_assembled',
    name: 'Ocean Wave Reflection',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Dual-frequency wave vertex displacement, Fresnel reflectivity, animated normal perturbation, and foam crests.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.65,h*.35,10,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#aff'); grad.addColorStop(.3,'#0ae'); grad.addColorStop(.7,'#048'); grad.addColorStop(1,'#012');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_pos;
varying vec2 v_uv;
void main() {
  v_uv = uv;
  vec3 pos = position;
  float w1 = sin(pos.x * 3.5 + u_time * 2.2) * cos(pos.y * 2.8 + u_time * 1.6) * 0.09;
  float w2 = sin(pos.x * 7.0 + u_time * 3.5) * sin(pos.z * 5.0 - u_time * 2.0) * 0.04;
  pos += normal * (w1 + w2);
  v_normal = normalize(normalMatrix * normal);
  v_pos = (modelViewMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_pos;
varying vec2 v_uv;
void main() {
  vec3 view = normalize(-v_pos);
  vec3 norm = normalize(v_normal);
  float nx = sin(v_uv.x * 20.0 + u_time * 2.5) * 0.06;
  float ny = cos(v_uv.y * 20.0 + u_time * 2.0) * 0.06;
  norm = normalize(norm + vec3(nx, ny, 0.0));
  float fresnel = pow(1.0 - max(dot(view, norm), 0.0), 2.8);
  float wave = sin(v_uv.x * 25.0 + u_time * 3.0) * cos(v_uv.y * 25.0 + u_time * 2.0);
  vec3 deep = vec3(0.03, 0.20, 0.48);
  vec3 mid  = vec3(0.10, 0.60, 0.80);
  vec3 foam = vec3(0.92, 0.98, 1.00);
  vec3 sky  = vec3(0.60, 0.85, 1.00);
  vec3 col = mix(deep, mid, fresnel + wave * 0.12);
  col = mix(col, sky, fresnel * 0.45);
  float foamMask = step(0.60, fresnel + wave * 0.22);
  col = mix(col, foam, foamMask * 0.85);
  gl_FragColor = vec4(col, 0.95);
}`
  },
  {
    id: 'summer_skydome_clouds',
    name: 'Skydome & Flowmap Clouds',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Animated skydome with procedural flowmap cloud advection, horizon gradient and sun scatter.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0,0,0,h);
      grad.addColorStop(0,'#1a8fe3'); grad.addColorStop(.45,'#6ec6f5'); grad.addColorStop(.7,'#b8e4f5'); grad.addColorStop(.9,'#ffe5b4'); grad.addColorStop(1,'#ffc87a');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.82)';
      [[.25,.3,.18,.09],[.55,.25,.22,.1],[.72,.38,.15,.07]].forEach(([x,y,rx,ry])=>{ctx.beginPath();ctx.ellipse(w*x,h*y,w*rx,h*ry,0,0,Math.PI*2);ctx.fill();});
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() {
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) { return noise(p)*0.5+noise(p*2.1+1.3)*0.25+noise(p*4.5+2.7)*0.125; }
void main() {
  vec2 flow = vec2(u_time*0.04, u_time*0.02);
  float cloud = fbm(v_uv*3.0+flow);
  float cloud2 = fbm(v_uv*6.0-flow*0.7+5.3);
  float density = smoothstep(0.38, 0.75, cloud*0.7+cloud2*0.3);
  float y = v_uv.y;
  vec3 zenith = vec3(0.12,0.42,0.88);
  vec3 mid_sky = vec3(0.52,0.80,0.98);
  vec3 horizon = vec3(0.95,0.82,0.60);
  vec3 sky = mix(horizon, mid_sky, smoothstep(0.0,0.4,y));
  sky = mix(sky, zenith, smoothstep(0.4,1.0,y));
  vec3 cloud_dark = vec3(0.75,0.80,0.88);
  vec3 cloud_lit  = vec3(1.0,0.98,0.95);
  vec3 clouds = mix(cloud_dark, cloud_lit, density);
  vec3 col = mix(sky, clouds, density*0.9);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_birds_particles',
    name: 'Flocking Birds (GPGPU)',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Boid-like velocity flow field across geometry surface, visualizing the flock separation and cohesion forces.',
    generate: (ctx, w, h) => {
      ctx.fillStyle='#c8e8f8'; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(25,25,50,0.85)';
      for(let i=0;i<18;i++){const x=w*(0.2+0.6*Math.random()),y=h*(0.2+0.6*Math.random());ctx.beginPath();ctx.ellipse(x,y,8,3,-0.4,0,Math.PI*2);ctx.fill();}
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
varying vec3 v_normal;
void main() {
  v_uv = uv;
  v_normal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
varying vec3 v_normal;
vec2 hash2(vec2 p) {
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453);
}
void main() {
  vec2 uv = v_uv * 5.0;
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  float minDist = 1.0;
  for(int y2=-1;y2<=1;y2++) for(int x2=-1;x2<=1;x2++) {
    vec2 nb = vec2(x2,y2);
    vec2 pt = 0.5 + 0.5*sin(u_time*0.8 + 6.28*hash2(cell+nb));
    minDist = min(minDist, length(nb+pt-f));
  }
  float light = max(dot(v_normal, normalize(vec3(1,1.2,0.8))), 0.0);
  vec3 sky   = vec3(0.55,0.82,0.98);
  vec3 birds = vec3(0.12,0.14,0.25);
  float flock = smoothstep(0.1,0.18,minDist)*(1.0-smoothstep(0.18,0.35,minDist));
  vec3 col = mix(sky, vec3(0.25,0.50,0.78), minDist*0.4);
  col = mix(col, birds, flock*0.9);
  col *= 0.7+0.3*light;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_birds_sim_velocity',
    name: 'Boids Velocity Compute',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Hue-mapped visualization of GPGPU boid velocity field: separation, cohesion, and alignment force vectors.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#00d2ff'); grad.addColorStop(.5,'#7b2ff7'); grad.addColorStop(1,'#0a0020');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
  vec2 uv = v_uv;
  vec2 vel = vec2(0.0);
  for(int i=0;i<8;i++) {
    float fi = float(i);
    vec2 boid = 0.5+0.4*sin(u_time*(0.4+fi*0.15)+vec2(hash(vec2(fi,0.3)),hash(vec2(fi,0.7)))*6.28);
    vec2 d = uv - boid;
    float len = length(d);
    vel += d/(len*len+0.01)*0.002 - d*0.015;
  }
  float angle = atan(vel.y, vel.x);
  float speed = clamp(length(vel)*8.0, 0.3, 1.0);
  vec3 col = hsv2rgb(vec3(angle/6.2831+0.5, 0.85, speed));
  col *= 0.6+0.4*sin(u_time*0.5+length(uv-0.5)*6.0);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_birds_sim_position',
    name: 'Boids Position Integrate',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'GPGPU position integration heatmap: particle trail density accumulated from animated boid positions.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
      grad.addColorStop(0,'#00ffaa'); grad.addColorStop(.5,'#0055ff'); grad.addColorStop(1,'#000820');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
  float heat = 0.0;
  for(int i=0;i<12;i++) {
    float fi = float(i);
    vec2 pos = 0.5+0.4*sin(u_time*(0.3+fi*0.12)+vec2(hash(vec2(fi,0.1)),hash(vec2(fi,0.9)))*6.28);
    float d = length(v_uv - pos);
    heat += 0.015/(d*d+0.003);
  }
  heat = clamp(heat, 0.0, 1.0);
  vec3 col = mix(vec3(0.0,0.05,0.35), vec3(0.0,0.75,0.60), smoothstep(0.0,0.5,heat));
  col = mix(col, vec3(0.8,1.0,0.85), smoothstep(0.5,1.0,heat));
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_postprocessing_lut',
    name: '3D LUT Color Grading',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Simulates the warm 3D LUT grade of Summer Afternoon: lifted shadows, golden highlights, cool midtones.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0,0,w,h);
      grad.addColorStop(0,'#ffcc88'); grad.addColorStop(.4,'#ff9944'); grad.addColorStop(.7,'#dd4422'); grad.addColorStop(1,'#220011');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_pos;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_pos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_pos;
vec3 applyLUT(vec3 col) {
  col = col * 0.88 + 0.06;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col *= mix(vec3(0.85,0.95,1.10), vec3(1.08,0.92,0.75), smoothstep(0.2,0.8,luma));
  col = col / (col + 0.5) * 1.5;
  return clamp(col, 0.0, 1.0);
}
void main() {
  vec3 sun = normalize(vec3(1.0, 1.2, 0.7));
  float diff = max(dot(v_normal, sun), 0.0);
  float spec = pow(diff, 32.0);
  vec3 base = mix(vec3(0.1,0.08,0.06), vec3(0.85,0.75,0.62), diff);
  base += vec3(1.0,0.9,0.6) * spec * 0.4;
  vec3 col = applyLUT(base);
  float vig = 1.0 - smoothstep(0.6, 1.2, length(v_pos.xy));
  col *= vig * 0.3 + 0.7;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_intro_transition',
    name: 'Cinematic Intro Wipe',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Radial noise-edge wipe transition with warm color wash, matching the Summer Afternoon cinematic intro.',
    generate: (ctx, w, h) => {
      ctx.fillStyle='#fffdf8'; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
      const grad = ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.4);
      grad.addColorStop(0,'rgba(255,200,100,0.9)'); grad.addColorStop(1,'rgba(255,240,220,0)');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(w/2,h/2,w*.45,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
void main() {
  float t = fract(u_time * 0.18);
  float dist = length(v_uv - 0.5);
  float edgeN = noise(v_uv * 8.0 + u_time * 0.5) * 0.08;
  float reveal = smoothstep(t-0.05, t+0.05, dist+edgeN);
  vec3 warm = mix(vec3(1.0,0.85,0.60), vec3(0.65,0.82,0.98), v_uv.y);
  vec3 col = mix(vec3(1.0,0.98,0.95), warm, reveal);
  float edge = smoothstep(0.04, 0.0, abs(dist+edgeN-t));
  col = mix(col, vec3(1.0,0.90,0.55), edge*0.8);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'summer_controls_move',
    name: 'Touch Joystick Circle',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Summer Afternoon analog joystick UI circle with pulsing glow ring and transparency.',
    generate: (ctx, w, h) => {
      ctx.fillStyle='rgba(30,30,40,1)'; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(120,200,255,0.9)'; ctx.lineWidth=14;
      ctx.beginPath(); ctx.arc(w/2,h/2,w*.36,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(120,200,255,0.25)'; ctx.beginPath(); ctx.arc(w/2,h/2,w*.28,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv - 0.5;
  float r = length(uv);
  float ring = smoothstep(0.38,0.36,r) - smoothstep(0.36,0.32,r);
  float fill = smoothstep(0.30,0.27,r);
  float dot_ = smoothstep(0.08,0.05,r);
  float pulse = 0.7+0.3*sin(u_time*2.5);
  vec3 col = vec3(0.08,0.09,0.15);
  col = mix(col, vec3(0.20,0.55,0.85)*0.35, fill*0.6);
  col = mix(col, vec3(0.45,0.78,1.0)*pulse, ring);
  col = mix(col, vec3(0.90,0.95,1.0), dot_);
  gl_FragColor = vec4(col, max(ring, max(fill*0.5, dot_)));
}`
  },
  {
    id: 'summer_controls_jump',
    name: 'Touch Jump Button',
    category: '☀️ Summer Afternoon',
    type: 'shader',
    description: 'Summer Afternoon jump button UI with orange bounce-pulse glow ring.',
    generate: (ctx, w, h) => {
      ctx.fillStyle='rgba(20,20,30,1)'; ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,180,80,0.9)'; ctx.lineWidth=14;
      ctx.beginPath(); ctx.arc(w/2,h/2,w*.36,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(255,180,80,0.3)'; ctx.beginPath(); ctx.arc(w/2,h/2,w*.28,0,Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
void main() { v_uv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv - 0.5;
  float r = length(uv);
  float ring = smoothstep(0.38,0.36,r) - smoothstep(0.36,0.32,r);
  float fill = smoothstep(0.30,0.27,r);
  float dot_ = smoothstep(0.07,0.04,r);
  float pulse = 0.6+0.4*abs(sin(u_time*3.5));
  vec3 col = vec3(0.07,0.07,0.10);
  col = mix(col, vec3(0.80,0.45,0.10)*0.4, fill*0.6);
  col = mix(col, vec3(1.0,0.68,0.22)*pulse, ring);
  col = mix(col, vec3(1.0,0.92,0.75), dot_);
  gl_FragColor = vec4(col, max(ring, max(fill*0.5, dot_)));
}`
  }
]

// 2. TOON & CEL SHADING PRESETS
const TOON_PRESETS = [
  {
    id: 'toon_classic_2tone',
    name: 'Toon Classic 2-Tone',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath(); ctx.arc(w * 0.58, h * 0.42, w * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.32, w * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'toon_anime_3tone',
    name: 'Toon Anime 3-Tone',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#4b4b66';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8b500';
      ctx.beginPath(); ctx.arc(w * 0.55, h * 0.45, w * 0.44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffa65';
      ctx.beginPath(); ctx.arc(w * 0.62, h * 0.38, w * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.32, w * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'toon_manga_ink',
    name: 'Toon Manga Ink & White',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#050505';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.56, h * 0.44, w * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = w * 0.04;
      ctx.beginPath(); ctx.arc(w/2, h/2, w * 0.48, 0, Math.PI * 2); ctx.stroke();
    }
  },
  {
    id: 'toon_warm_comic',
    name: 'Toon Warm Comic Book',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#574b90';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e15f41';
      ctx.beginPath(); ctx.arc(w * 0.55, h * 0.45, w * 0.44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f7d794';
      ctx.beginPath(); ctx.arc(w * 0.62, h * 0.38, w * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.32, w * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'toon_cyber_cel',
    name: 'Toon Cyber Neon Cel',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#1e0038';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath(); ctx.arc(w * 0.55, h * 0.45, w * 0.44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath(); ctx.arc(w * 0.62, h * 0.38, w * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.32, w * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'toon_pastel_anime',
    name: 'Toon Pastel Dream',
    category: 'Toon Shaders',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#778beb';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8a5c2';
      ctx.beginPath(); ctx.arc(w * 0.55, h * 0.45, w * 0.44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ea8685';
      ctx.beginPath(); ctx.arc(w * 0.62, h * 0.38, w * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.32, w * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  },
  { id: 'toon_extracted', name: 'Authentic Toon Cel', category: 'Toon Shaders', url: '/assets/matcaps/toon.jpeg' },
  { id: 'check_rim_dark_toon', name: 'Toon Rim Shadow Check', category: 'Toon Shaders', url: '/assets/matcaps/check_rim_dark.jpeg' }
];

// 3. FLAT & GRAPHIC COLORS
const FLAT_COLOR_PRESETS = [
  {
    id: 'flat_graphic_white',
    name: 'Flat Graphic White',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_pitch_black',
    name: 'Flat Silhouette Black',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_pop_red',
    name: 'Flat Pop Art Red',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#ff3838';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_cyber_yellow',
    name: 'Flat Cyber Yellow',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#ffd32a';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_electric_blue',
    name: 'Flat Electric Blue',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#18dcff';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_vibrant_orange',
    name: 'Flat Vibrant Orange',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#ff9f1a';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_pastel_lilac',
    name: 'Flat Pastel Lilac',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#cd84f1';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'flat_mint_cyan',
    name: 'Flat Mint Green',
    category: 'Flat Colors',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#7efff5';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  }
];

// 4. GLASS & CRYSTAL PRESETS
const GLASS_PRESETS = [
  {
    id: 'glass_crystal_clear',
    name: 'Crystal Clear Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#10121a';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      const ring = ctx.createRadialGradient(w/2, h/2, w*0.35, w/2, h/2, w*0.5);
      ring.addColorStop(0, 'rgba(255,255,255,0.0)');
      ring.addColorStop(0.7, 'rgba(180,225,255,0.4)');
      ring.addColorStop(0.95, 'rgba(255,255,255,0.95)');
      ring.addColorStop(1, 'rgba(30,60,100,0.6)');
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      const spec = ctx.createRadialGradient(w*0.65, h*0.35, 2, w*0.65, h*0.35, w*0.22);
      spec.addColorStop(0, 'rgba(255,255,255,1.0)');
      spec.addColorStop(0.35, 'rgba(255,255,255,0.7)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'glass_frosted_cyan',
    name: 'Frosted Cyan Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.5, h*0.5, w*0.08, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#0a2233');
      grad.addColorStop(0.55, '#144c6b');
      grad.addColorStop(0.88, '#70e5ff');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'glass_ruby_wine',
    name: 'Ruby Wine Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.6, h*0.4, 8, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#ff2a6d');
      grad.addColorStop(0.65, '#5c0524');
      grad.addColorStop(0.92, '#ff7597');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'glass_emerald_bottle',
    name: 'Emerald Bottle Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.62, h*0.38, 8, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#05c46b');
      grad.addColorStop(0.65, '#043820');
      grad.addColorStop(0.9, '#80ffdb');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'glass_prism_rainbow',
    name: 'Prism Rainbow Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#0e111a';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      const rainbow = ctx.createLinearGradient(0, 0, w, h);
      rainbow.addColorStop(0.0, 'rgba(255,0,0,0.6)');
      rainbow.addColorStop(0.2, 'rgba(255,165,0,0.6)');
      rainbow.addColorStop(0.4, 'rgba(255,255,0,0.6)');
      rainbow.addColorStop(0.6, 'rgba(0,255,0,0.6)');
      rainbow.addColorStop(0.8, 'rgba(0,100,255,0.6)');
      rainbow.addColorStop(1.0, 'rgba(180,0,255,0.6)');
      ctx.fillStyle = rainbow;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      const spec = ctx.createRadialGradient(w*0.65, h*0.35, 2, w*0.65, h*0.35, w*0.25);
      spec.addColorStop(0, 'rgba(255,255,255,1.0)');
      spec.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = spec;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'glass_smoked_obsidian',
    name: 'Smoked Obsidian Glass',
    category: 'Glass & Crystal',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.65, h*0.35, 5, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.2, 'rgba(200,200,210,0.5)');
      grad.addColorStop(0.7, '#111216');
      grad.addColorStop(0.95, '#5b6272');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  }
];

// 5. BRIGHT COLORS & NEON PRESETS
const BRIGHT_COLOR_PRESETS = [
  {
    id: 'bright_neon_cyan',
    name: 'Electric Neon Cyan',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#00f7ff');
      grad.addColorStop(0.7, '#0066ff');
      grad.addColorStop(1, '#001a40');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'bright_neon_magenta',
    name: 'Cyberpunk Magenta',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#ff007f');
      grad.addColorStop(0.65, '#8800ff');
      grad.addColorStop(1, '#220033');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'bright_sunburst_yellow',
    name: 'Sunburst Gold Glow',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#ffea00');
      grad.addColorStop(0.7, '#ff5500');
      grad.addColorStop(1, '#4a1500');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'bright_acid_green',
    name: 'Toxic Acid Lime',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#76ff03');
      grad.addColorStop(0.7, '#00bfa5');
      grad.addColorStop(1, '#003322');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'bright_ultraviolet',
    name: 'Electric Ultraviolet',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#c77dff');
      grad.addColorStop(0.7, '#5a189a');
      grad.addColorStop(1, '#10002b');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'bright_hot_lava',
    name: 'Hot Molten Lava',
    category: 'Bright Colors',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#ffdd59');
      grad.addColorStop(0.55, '#ff3f34');
      grad.addColorStop(1, '#3c0008');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  }
];

// 6. METALS & CHROME PRESETS
const METAL_PRESETS = [
  { id: 'metal_shiny', name: 'Chrome Mirror Shiny', category: 'Metals', url: '/assets/matcaps/metal_shiny.jpeg' },
  { id: 'metal_carpaint', name: 'Metallic Red Car Paint', category: 'Metals', url: '/assets/matcaps/metal_carpaint.jpeg' },
  { id: 'metal_anisotropic', name: 'Anisotropic Brushed Steel', category: 'Metals', url: '/assets/matcaps/metal_anisotropic.jpeg' },
  { id: 'metal_lead', name: 'Heavy Lead Metal', category: 'Metals', url: '/assets/matcaps/metal_lead.jpeg' },
  { id: 'reflection_check_h', name: 'Chrome Horizon Stripe', category: 'Metals', url: '/assets/matcaps/reflection_check_horizontal.jpeg' },
  { id: 'reflection_check_v', name: 'Chrome Vertical Studio', category: 'Metals', url: '/assets/matcaps/reflection_check_vertical.jpeg' },
  {
    id: 'metal_gold_ingot',
    name: 'Polished Gold Ingot',
    category: 'Metals',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#ffeaa7');
      grad.addColorStop(0.65, '#d4af37');
      grad.addColorStop(0.9, '#8c6d17');
      grad.addColorStop(1, '#3d2b00');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'metal_copper_rose',
    name: 'Burnished Copper',
    category: 'Metals',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#f8a5c2');
      grad.addColorStop(0.65, '#b33939');
      grad.addColorStop(0.9, '#78281f');
      grad.addColorStop(1, '#33100c');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  }
];

// 7. CLAY & MATTE PRESETS
const CLAY_PRESETS = [
  { id: 'clay_studio', name: 'Classic Clay Studio', category: 'Clay & Matte', url: '/assets/matcaps/clay_studio.jpeg' },
  { id: 'clay_brown', name: 'Terracotta Clay Brown', category: 'Clay & Matte', url: '/assets/matcaps/clay_brown.jpeg' },
  { id: 'clay_muddy', name: 'Muddy Earth Clay', category: 'Clay & Matte', url: '/assets/matcaps/clay_muddy.jpeg' },
  { id: 'ceramic_dark', name: 'Dark Ceramic Glaze', category: 'Clay & Matte', url: '/assets/matcaps/ceramic_dark.jpeg' },
  { id: 'ceramic_lightbulb', name: 'Lightbulb Ceramic', category: 'Clay & Matte', url: '/assets/matcaps/ceramic_lightbulb.jpeg' },
  { id: 'basic_1', name: 'Basic Studio Gray 1', category: 'Clay & Matte', url: '/assets/matcaps/basic_1.jpg' },
  { id: 'basic_2', name: 'Basic Studio Gray 2', category: 'Clay & Matte', url: '/assets/matcaps/basic_2.jpg' },
  { id: 'basic_dark', name: 'Basic Dark Studio', category: 'Clay & Matte', url: '/assets/matcaps/basic_dark.jpeg' },
  { id: 'basic_side', name: 'Basic Side Light', category: 'Clay & Matte', url: '/assets/matcaps/basic_side.jpeg' }
];

// 8. GEMS & ORGANICS PRESETS
const GEMS_PRESETS = [
  { id: 'jade', name: 'Imperial Jade Gem', category: 'Gems & Organics', url: '/assets/matcaps/jade.jpeg' },
  { id: 'pearl', name: 'Lustrous Pearl', category: 'Gems & Organics', url: '/assets/matcaps/pearl.jpeg' },
  { id: 'resin', name: 'Amber Resin Gem', category: 'Gems & Organics', url: '/assets/matcaps/resin.jpeg' },
  { id: 'skin', name: 'Subsurface Skin Tone', category: 'Gems & Organics', url: '/assets/matcaps/skin.jpeg' },
  { id: 'check_normal_y', name: 'Normal Vector Map', category: 'Gems & Organics', url: '/assets/matcaps/check_normal+y.jpeg' },
  {
    id: 'gem_sapphire',
    name: 'Deep Blue Sapphire',
    category: 'Gems & Organics',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#48dbfb');
      grad.addColorStop(0.65, '#0c2461');
      grad.addColorStop(0.9, '#1e3799');
      grad.addColorStop(1, '#050c1e');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'gem_amethyst',
    name: 'Amethyst Crystal',
    category: 'Gems & Organics',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#d980fa');
      grad.addColorStop(0.65, '#5758bb');
      grad.addColorStop(0.9, '#9980fa');
      grad.addColorStop(1, '#1b1464');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    }
  }
];

// FUN & MAGIC ANIMATED LIVE SHADERS
export const FUN_MAGIC_SHADERS = [
  {
    id: 'magic_rainbow_pulse',
    name: 'Rainbow Pulse',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      // Thumbnail: spinning rainbow gradient
      for (let i = 0; i < 6; i++) {
        const hue = i * 60;
        const grad = ctx.createRadialGradient(w*0.5, h*0.5, w*i*0.07, w*0.5, h*0.5, w*(i+1)*0.07);
        grad.addColorStop(0, `hsla(${hue},100%,65%,1)`);
        grad.addColorStop(1, `hsla(${hue+60},100%,65%,1)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      }
      const shine = ctx.createRadialGradient(w*0.6, h*0.35, 2, w*0.6, h*0.35, w*0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.9)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;

vec3 rainbow(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float fresnel = 1.0 - max(dot(v_normal, v_view_dir), 0.0);
  float t = fresnel * 3.0 + u_time * 0.8 + v_normal.y * 2.0;
  vec3 col = rainbow(t);
  float pulse = 0.8 + 0.2 * sin(u_time * 4.0 + fresnel * 8.0);
  gl_FragColor = vec4(col * pulse, 1.0);
}`
  },
  {
    id: 'magic_electric_arc',
    name: 'Electric Arc',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#050518';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      // Electric blue-white rim
      const rim = ctx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.5);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(0.7, 'rgba(80,160,255,0.5)');
      rim.addColorStop(0.95, 'rgba(180,220,255,0.95)');
      rim.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      // Spark bolt
      ctx.strokeStyle = '#00eeff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w*0.45, h*0.3);
      ctx.lineTo(w*0.52, h*0.5);
      ctx.lineTo(w*0.47, h*0.55);
      ctx.lineTo(w*0.55, h*0.72);
      ctx.stroke();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec3 v_position;
uniform float u_time;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec3 pos = position;
  float bolt = sin(pos.y * 18.0 + u_time * 20.0) * 0.012 * max(0.0, sin(u_time * 5.0));
  pos.x += bolt;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  v_view_dir = normalize(-mv.xyz);
  v_position = pos;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec3 v_position;

void main() {
  float fresnel = pow(1.0 - max(dot(v_normal, v_view_dir), 0.0), 2.0);
  
  // Core dark body
  vec3 col = vec3(0.02, 0.04, 0.12);
  
  // Electric glow on rim
  float spark = sin(v_position.y * 30.0 + u_time * 25.0) * 0.5 + 0.5;
  spark *= sin(v_position.x * 20.0 - u_time * 18.0) * 0.5 + 0.5;
  vec3 arc_color = mix(vec3(0.1, 0.4, 1.0), vec3(0.8, 0.95, 1.0), spark);
  
  col = mix(col, arc_color, fresnel * 1.2);
  col += arc_color * pow(spark, 3.0) * fresnel * 0.8;
  
  // Constant electric rim glow
  col += vec3(0.05, 0.15, 0.5) * pow(fresnel, 2.0);
  
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'magic_lava_flow',
    name: 'Lava Flow',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.6, h*0.4, 5, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.15, '#ffee00');
      grad.addColorStop(0.4, '#ff5500');
      grad.addColorStop(0.7, '#cc1100');
      grad.addColorStop(0.88, '#330800');
      grad.addColorStop(1, '#0a0000');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec3 v_position;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  v_position = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec3 v_position;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}

void main() {
  vec2 uv = v_uv * 3.0 + vec2(0.0, -u_time * 0.3);
  float n1 = noise(uv + vec2(u_time * 0.2, 0.0));
  float n2 = noise(uv * 2.0 - vec2(u_time * 0.15, u_time * 0.1));
  float lava = n1 * 0.6 + n2 * 0.4;

  vec3 dark_rock = vec3(0.04, 0.01, 0.0);
  vec3 hot_orange = vec3(1.0, 0.35, 0.0);
  vec3 bright_core = vec3(1.0, 0.95, 0.3);

  vec3 col = mix(dark_rock, hot_orange, smoothstep(0.35, 0.65, lava));
  col = mix(col, bright_core, smoothstep(0.65, 0.9, lava));

  // Edge glow
  float fresnel = pow(1.0 - max(dot(v_normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
  col += vec3(1.0, 0.2, 0.0) * fresnel * 0.5;

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'magic_soap_bubble',
    name: 'Soap Bubble',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(10,12,20,0.95)';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      const irid = ctx.createLinearGradient(0, 0, w, h);
      irid.addColorStop(0.0, 'rgba(255,100,200,0.5)');
      irid.addColorStop(0.25, 'rgba(100,200,255,0.5)');
      irid.addColorStop(0.5, 'rgba(200,255,100,0.5)');
      irid.addColorStop(0.75, 'rgba(255,180,50,0.5)');
      irid.addColorStop(1.0, 'rgba(200,80,255,0.5)');
      ctx.fillStyle = irid;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      const rim = ctx.createRadialGradient(w/2, h/2, w*0.32, w/2, h/2, w*0.5);
      rim.addColorStop(0, 'rgba(255,255,255,0.0)');
      rim.addColorStop(0.85, 'rgba(255,255,255,0.15)');
      rim.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;

vec3 rainbow(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float fresnel = 1.0 - max(dot(v_normal, v_view_dir), 0.0);
  
  // Thin-film soap iridescence — shifts with angle and time
  float film = fresnel * 5.0 + u_time * 0.4 + v_normal.x * 2.0 + v_normal.y * 1.5;
  vec3 irid = rainbow(film);
  
  // Very transparent interior, colorful rim
  float alpha_rim = pow(fresnel, 1.2);
  vec3 col = irid * alpha_rim;
  
  // Soft specular highlight
  float spec = pow(max(dot(v_normal, normalize(vec3(0.5, 0.7, 1.0))), 0.0), 24.0);
  col += vec3(spec * 0.6);

  gl_FragColor = vec4(col, 0.5 + fresnel * 0.45);
}`
  },
  {
    id: 'magic_sparkle_glitter',
    name: 'Magic Glitter',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w*0.65, h*0.35, 5, w*0.5, h*0.5, w*0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#e040fb');
      grad.addColorStop(0.65, '#6200ea');
      grad.addColorStop(1, '#12005e');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      // Sparkle dots
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const r = w * (0.15 + Math.random() * 0.3);
        const x = w/2 + Math.cos(angle) * r;
        const y = h/2 + Math.sin(angle) * r;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
      }
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  v_uv = uv;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec2 v_uv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }

void main() {
  float fresnel = 1.0 - max(dot(v_normal, v_view_dir), 0.0);

  // Base purple-violet
  vec3 col = mix(vec3(0.1, 0.0, 0.25), vec3(0.7, 0.1, 1.0), fresnel);

  // Animated glitter — random sparks scattered across surface
  vec2 grid = v_uv * 18.0;
  vec2 cell = floor(grid);
  float spark_phase = hash(cell) * 6.28318;
  float spark = pow(max(0.0, sin(u_time * 4.0 + spark_phase)), 12.0);
  spark *= step(hash(cell + 0.5), 0.4); // Only 40% of cells sparkle

  col += vec3(spark * 1.5);

  // Rainbow shimmer on rim
  float hue_t = fresnel * 4.0 + u_time * 0.5;
  vec3 shimmer = 0.5 + 0.5 * cos(6.28318 * (hue_t + vec3(0.0, 0.33, 0.67)));
  col = mix(col, shimmer, fresnel * 0.4);

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'magic_hologram_scan',
    name: 'Hologram Scan',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#010a0a';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      const rim = ctx.createRadialGradient(w/2, h/2, w*0.28, w/2, h/2, w*0.5);
      rim.addColorStop(0, 'rgba(0,255,200,0.0)');
      rim.addColorStop(0.7, 'rgba(0,255,180,0.3)');
      rim.addColorStop(1, 'rgba(0,255,200,0.95)');
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      // Scan lines
      for (let y = 0; y < h; y += 12) {
        ctx.fillStyle = 'rgba(0,255,180,0.12)';
        ctx.fillRect(0, y, w, 4);
      }
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec3 v_position;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  v_position = position;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;
varying vec3 v_position;

void main() {
  float fresnel = pow(1.0 - max(dot(v_normal, v_view_dir), 0.0), 1.5);

  // Animated scan line sweep
  float scan_y = mod(v_position.y * 4.0 - u_time * 2.0, 1.0);
  float scanline = step(0.85, scan_y) * 0.6;

  // Holographic teal core
  vec3 holo = vec3(0.0, 1.0, 0.75);
  vec3 col = holo * (fresnel * 0.9 + 0.05);

  // Horizontal scan band moving up
  float sweep = smoothstep(0.0, 0.08, abs(scan_y - 0.5));
  col += holo * (1.0 - sweep) * 0.35;

  // Grid-line flicker
  col += holo * scanline * fresnel;

  // Flicker noise
  float flicker = 0.9 + 0.1 * sin(u_time * 60.0 + v_position.y * 100.0);
  col *= flicker;

  gl_FragColor = vec4(col, 0.75 + fresnel * 0.2);
}`
  },
  {
    id: 'magic_candy_chrome',
    name: 'Candy Chrome',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      // Pastel chrome gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0.0, '#ff9de2');
      grad.addColorStop(0.2, '#a8edea');
      grad.addColorStop(0.4, '#fed6e3');
      grad.addColorStop(0.6, '#a1c4fd');
      grad.addColorStop(0.8, '#ffecd2');
      grad.addColorStop(1.0, '#ff9de2');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      const shine = ctx.createRadialGradient(w*0.65, h*0.35, 2, w*0.65, h*0.35, w*0.3);
      shine.addColorStop(0, 'rgba(255,255,255,1.0)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      shine.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = shine;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;

vec3 pastelRainbow(float t) {
  return 0.75 + 0.22 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float fresnel = 1.0 - max(dot(v_normal, v_view_dir), 0.0);
  
  // Pastel color shift with normal angle + slow time drift
  float hue = (v_normal.x + v_normal.y) * 1.5 + u_time * 0.25;
  vec3 candy = pastelRainbow(hue);
  
  // Chrome-like reflective sheen
  float spec = pow(max(dot(v_normal, normalize(vec3(0.5, 0.8, 1.0))), 0.0), 32.0);
  vec3 col = candy + vec3(spec * 0.8);

  // Soft rim
  col = mix(col, vec3(1.0), fresnel * 0.25);
  
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'magic_xray',
    name: 'X-Ray',
    category: '✨ Fun & Magic',
    type: 'shader',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#000508';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
      const rim = ctx.createRadialGradient(w/2, h/2, w*0.25, w/2, h/2, w*0.5);
      rim.addColorStop(0, 'rgba(150,220,255,0.0)');
      rim.addColorStop(0.75, 'rgba(150,220,255,0.5)');
      rim.addColorStop(1, 'rgba(220,245,255,1.0)');
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_view_dir;
void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_dir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_view_dir;

void main() {
  float fresnel = pow(1.0 - max(dot(v_normal, v_view_dir), 0.0), 1.8);
  float pulse = 0.85 + 0.15 * sin(u_time * 2.0);
  vec3 xray = vec3(0.55, 0.88, 1.0) * fresnel * pulse * 2.2;
  gl_FragColor = vec4(xray, fresnel * 0.9);
}`
  }
];


// 🌍 WONDERLUST WEBGPU ANIMATED LIVE SHADERS
export const WONDERLUST_PRESETS = [
  {
    id: 'wonderlust_anime_water',
    name: 'Anime Caustics Water',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: 'Procedural Voronoi water caustics with smooth minimum edge rings, 3-tier anime depth palette, and animated wave flow.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#4da9e8');
      grad.addColorStop(0.65, '#1a4a8c');
      grad.addColorStop(1, '#091c38');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
      // Caustic web lines
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(w*0.3 + i*30, h*0.3 + (i%3)*40, 25, 0, Math.PI*2);
        ctx.stroke();
      }
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec3 v_world_pos;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  v_world_pos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec3 v_world_pos;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k / 6.0;
}

vec2 cellPt(vec2 seed) {
  return 0.5 + 0.5 * sin(u_time * 0.8 + 6.2831 * seed);
}

float voronoiF1(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float md = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(float(x), float(y));
      vec2 pt = cellPt(hash2(i + n));
      md = min(md, length(n + pt - f));
    }
  }
  return md;
}

float voronoiSF1(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float res = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(float(x), float(y));
      vec2 pt = cellPt(hash2(i + n));
      res = smin(res, length(n + pt - f), 0.25);
    }
  }
  return res;
}

void main() {
  vec2 uv = (v_normal.xy * 0.5 + 0.5) * 6.0 + vec2(u_time * 0.08, u_time * 0.05);
  float f1 = voronoiF1(uv);
  float sf1 = voronoiSF1(uv);
  float edge = f1 - sf1;

  float t = smoothstep(0.03, 0.08, edge);
  vec3 deepColor = vec3(0.04, 0.15, 0.38);
  vec3 midColor = vec3(0.25, 0.65, 0.95);
  vec3 highlight = vec3(1.0, 1.0, 1.0);

  vec3 col = mix(deepColor, midColor, smoothstep(0.0, 0.5, t));
  col = mix(col, highlight, smoothstep(0.5, 1.0, t));

  // Fresnel edge brightness
  float fresnel = pow(1.0 - max(dot(v_normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
  col += vec3(0.3, 0.7, 1.0) * fresnel * 0.6;

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'wonderlust_ghibli_summer',
    name: 'Ghibli Summer Split-Toning',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: 'Golden sunlit highlights, soft atmospheric cerulean shadows, chlorophyll saturation boost, and celluloid vignette.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#fff4cc');
      grad.addColorStop(0.3, '#78c25e');
      grad.addColorStop(0.7, '#257d5a');
      grad.addColorStop(1, '#0e2b38');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec2 v_uv;

void main() {
  // Lighting computation with sun vector
  vec3 sunDir = normalize(vec3(0.5, 0.8, 0.6));
  float NdotL = max(dot(v_normal, sunDir), 0.0);
  
  // Base lush nature palette
  vec3 shadowCol = vec3(0.08, 0.22, 0.32);
  vec3 midCol = vec3(0.22, 0.55, 0.25);
  vec3 litCol = vec3(0.68, 0.88, 0.38);

  vec3 col = mix(shadowCol, midCol, smoothstep(0.1, 0.45, NdotL));
  col = mix(col, litCol, smoothstep(0.45, 0.9, NdotL));

  // Ghibli Summer Split-Toning
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 warmGold = col * vec3(1.12, 1.05, 0.88);
  vec3 azureShadow = col * vec3(0.90, 0.96, 1.10);
  col = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));

  // Lush saturation boost
  col = mix(vec3(lum), col, 1.25);

  // Optical sun shimmer on highlight peaks
  col += max(vec3(0.0), col - 0.55) * vec3(0.18, 0.14, 0.04);

  // Celluloid rim
  float fresnel = pow(1.0 - max(dot(v_normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
  col += vec3(0.9, 0.95, 0.7) * fresnel * 0.4;

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'wonderlust_journey_sand',
    name: 'Journey Desert Sand & Shimmer',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: 'Warm desert dunes with Journey-inspired sparkling Blinn-Phong micro-glitter and ridge rim lighting.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#fff2d1');
      grad.addColorStop(0.3, '#f39c12');
      grad.addColorStop(0.7, '#d35400');
      grad.addColorStop(1, '#5c1d00');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_position;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_position = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  vec3 viewDir = normalize(-v_position);
  vec3 lightDir = normalize(vec3(0.6, 0.8, 0.5));
  vec3 halfDir = normalize(lightDir + viewDir);

  float NdotL = max(dot(v_normal, lightDir), 0.0);
  vec3 sandShadow = vec3(0.38, 0.16, 0.06);
  vec3 sandMid = vec3(0.92, 0.58, 0.22);
  vec3 sandSun = vec3(1.0, 0.86, 0.55);

  vec3 col = mix(sandShadow, sandMid, smoothstep(0.08, 0.45, NdotL));
  col = mix(col, sandSun, smoothstep(0.45, 0.92, NdotL));

  // Dune rim lighting along grazing angles
  float rim = 1.0 - max(dot(v_normal, viewDir), 0.0);
  float rimStrength = pow(rim, 3.8) * 0.65;
  col += vec3(1.0, 0.78, 0.42) * rimStrength;

  // Journey Sand Specular Shimmer (Continuous organic micro-glitter, NO chunky pixels)
  float spec = pow(max(dot(v_normal, halfDir), 0.0), 20.0);
  vec3 p = v_position * 120.0;
  float s1 = sin(p.x * 1.5 + sin(p.y * 1.7 + u_time * 2.5) * 2.8);
  float s2 = cos(p.y * 1.6 + cos(p.z * 1.4 - u_time * 2.0) * 2.8);
  float s3 = sin(p.z * 1.8 + sin(p.x * 1.9 + u_time * 1.2) * 2.8);
  float sparkle = pow(clamp(s1 * s2 * s3 * 0.5 + 0.5, 0.0, 1.0), 10.0) * 4.5;

  col += vec3(1.0, 0.90, 0.65) * spec * (0.35 + sparkle * 1.4);

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'wonderlust_glacial_snow',
    name: 'Glacial Diamond Snow & Ice',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: 'Crisp sky-blue rim highlight, dynamic diamond snow glitter sparkle effect, and glacial subsurface ice tones.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w * 0.65, h * 0.35, 10, w * 0.5, h * 0.5, w * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#bfe9ff');
      grad.addColorStop(0.7, '#4895ef');
      grad.addColorStop(1, '#0e244d');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_position;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_position = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  vec3 viewDir = normalize(-v_position);
  vec3 lightDir = normalize(vec3(0.5, 0.9, 0.4));
  vec3 halfDir = normalize(lightDir + viewDir);

  float NdotL = max(dot(v_normal, lightDir), 0.0);
  vec3 snowDeep = vec3(0.12, 0.26, 0.50);
  vec3 snowMid = vec3(0.68, 0.86, 0.98);
  vec3 snowHighlight = vec3(1.0, 1.0, 1.0);

  vec3 col = mix(snowDeep, snowMid, smoothstep(0.08, 0.48, NdotL));
  col = mix(col, snowHighlight, smoothstep(0.48, 0.92, NdotL));

  // Glacial crisp sky-blue rim
  float snowRim = 1.0 - max(dot(v_normal, viewDir), 0.0);
  col += vec3(0.65, 0.88, 1.0) * pow(snowRim, 3.2) * 0.85;

  // Diamond snow micro-sparkle (Continuous crystalline glints, NO chunky pixels)
  float spec = pow(max(dot(v_normal, halfDir), 0.0), 22.0);
  vec3 p = v_position * 135.0;
  float s1 = sin(p.x * 1.6 + cos(p.y * 1.9 + u_time * 2.6) * 3.0);
  float s2 = cos(p.y * 1.7 + sin(p.z * 1.8 - u_time * 2.2) * 3.0);
  float s3 = sin(p.z * 2.0 + cos(p.x * 1.4 + u_time * 1.4) * 3.0);
  float diamondSparkle = pow(clamp(s1 * s2 * s3 * 0.5 + 0.5, 0.0, 1.0), 12.0) * 5.0;

  col += vec3(0.90, 0.96, 1.0) * spec * (0.3 + diamondSparkle * 1.6);

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'wonderlust_crystal_glow',
    name: 'Prismatic Instanced Crystal',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: '6-stop smooth cubic color gradient, animated hue shifting, Fresnel rim glow, and vibrance boosting.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0.0, '#ff007f');
      grad.addColorStop(0.25, '#7928ca');
      grad.addColorStop(0.5, '#0070f3');
      grad.addColorStop(0.75, '#00dfd8');
      grad.addColorStop(1.0, '#79ffe1');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_position;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_position = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float tC = clamp((v_position.y + 1.2) / 2.4, 0.0, 1.0);
  
  // 6 color stops
  vec3 c0 = vec3(0.9, 0.1, 0.5);
  vec3 c1 = vec3(0.5, 0.1, 0.9);
  vec3 c2 = vec3(0.1, 0.4, 1.0);
  vec3 c3 = vec3(0.0, 0.9, 0.8);
  vec3 c4 = vec3(0.4, 1.0, 0.5);
  vec3 c5 = vec3(1.0, 0.9, 0.2);

  float segment = tC * 5.0;
  int idx = int(floor(segment));
  float frac = fract(segment);
  float t = frac * frac * (3.0 - 2.0 * frac);

  vec3 gradCol;
  if (idx == 0) gradCol = mix(c0, c1, t);
  else if (idx == 1) gradCol = mix(c1, c2, t);
  else if (idx == 2) gradCol = mix(c2, c3, t);
  else if (idx == 3) gradCol = mix(c3, c4, t);
  else gradCol = mix(c4, c5, t);

  // Time-based hue shift
  vec3 hsv = rgb2hsv(gradCol);
  hsv.x = fract(hsv.x + u_time * 0.1);
  gradCol = hsv2rgb(hsv);

  // High power Fresnel rim glow
  float fresnel = pow(1.0 - max(dot(v_normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
  vec3 rimCol = mix(gradCol, vec3(1.0), 0.6);
  vec3 finalCol = mix(gradCol, rimCol, fresnel * 0.8);

  // Vibrance
  vec3 hsvFinal = rgb2hsv(finalCol);
  hsvFinal.y = min(hsvFinal.y * 1.3, 1.0);
  hsvFinal.z = min(hsvFinal.z * 1.2, 1.0);

  gl_FragColor = vec4(hsv2rgb(hsvFinal), 1.0);
}`
  },
  {
    id: 'wonderlust_beach_shoreline',
    name: 'Anime Beach Shoreline',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: 'Stylized anime beach shoreline with oscillating wave foam, turquoise shallow sea, deep waters, and warm sand.',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#f5d77f'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h*0.35, w, 20);
      ctx.fillStyle = '#00d2d3'; ctx.fillRect(0, h*0.4, w, h*0.3);
      ctx.fillStyle = '#0984e3'; ctx.fillRect(0, h*0.7, w, h*0.3);
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
varying vec3 v_normal;
void main() {
  v_uv = uv;
  v_normal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
varying vec3 v_normal;

#define PI 3.14159265359

float plotFoam(vec2 st, float pct) {
  return step(pct + 0.06, st.y) - step(pct + 0.08 + abs(sin(u_time * 0.8) * 0.15), st.y);
}
float plotSand(vec2 st, float pct) {
  return step(pct + 0.08, st.y);
}
float plotSea(vec2 st, float pct) {
  return step(pct - 0.45, st.y) - step(pct + 0.06, st.y);
}
float plotDeepSea(vec2 st, float pct) {
  return 1.0 - step(pct - 0.45, st.y);
}

void main() {
  vec2 st = v_uv;
  float y = sin(u_time * 0.8) * 0.15 + sin(PI * 6.0 * st.x) * 0.03 + st.x * 0.3 + 0.35;

  float foam = plotFoam(st, y);
  float sand = plotSand(st, y);
  float sea = plotSea(st, y);
  float deepSea = plotDeepSea(st, y);

  vec3 sandCol = vec3(0.96, 0.82, 0.45);
  vec3 foamCol = vec3(1.0, 1.0, 1.0);
  vec3 seaCol = vec3(0.0, 0.82, 0.95);
  vec3 deepSeaCol = vec3(0.08, 0.25, 0.65);

  vec3 col = sand * sandCol + foam * foamCol + sea * seaCol + deepSea * deepSeaCol;
  
  // Soft 3D lighting shading
  float diff = max(dot(v_normal, normalize(vec3(0.4, 0.7, 0.6))), 0.0);
  col *= (0.75 + diff * 0.3);

  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'wonderlust_sunset_ocean',
    name: 'Minimalist Sunset Ocean',
    category: '🌍 Wonderlust',
    type: 'shader',
    description: '3-color minimalist animated ocean sunset gradient with organic wave displacement and warm twilight glow.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f39c12');
      grad.addColorStop(0.5, '#e74c3c');
      grad.addColorStop(1, '#2c3e50');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
varying vec2 v_uv;
varying vec3 v_normal;
void main() {
  v_uv = uv;
  v_normal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec2 v_uv;
varying vec3 v_normal;

float cnoise(vec2 uv) {
  const mat2 r = mat2(-0.1288, -0.9917, 0.9917, -0.1288);
  vec2 s0 = cos(uv);
  vec2 s1 = cos(uv * 2.5 * r);
  vec2 s2 = cos(uv * 4.0 * r * r);
  vec2 s = s0 * s1 * s2;
  return (s.x + s.y) * 0.25 + 0.5;
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;

  // Wave displacement
  float wave = cnoise(uv * vec2(2.0, 15.0) + u_time * 1.5) * 0.08;
  vec2 st = vec2(uv.x, uv.y + wave);

  vec3 sunGold = vec3(1.0, 0.78, 0.2);
  vec3 orangeSky = vec3(0.95, 0.42, 0.12);
  vec3 twilightDeep = vec3(0.18, 0.08, 0.25);

  vec3 col = mix(sunGold, orangeSky, smoothstep(-0.4, 0.4, st.y));
  col = mix(col, twilightDeep, smoothstep(0.2, 0.9, -st.y));

  // Sun disc in center
  float sunDisc = smoothstep(0.35, 0.33, length(uv - vec2(0.0, 0.15)));
  col = mix(col, vec3(1.0, 0.95, 0.8), sunDisc * 0.8);

  // Soft spherical shading
  float diff = max(dot(v_normal, normalize(vec3(0.2, 0.5, 0.8))), 0.0);
  col *= (0.7 + diff * 0.35);

  gl_FragColor = vec4(col, 1.0);
}`
  }
];

// ASSEMBLE ALL PRESETS
export const ALL_MATERIAL_PRESETS = [
  ...BLOBMIXER_MATERIAL_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...SUMMER_SHADERS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...GODOT_MATERIAL_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...WONDERLUST_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...WAYFINDER_MATERIAL_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...GRASSWORKS_MATERIAL_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...REZE_MATERIAL_PRESETS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...DESKTOP_SHADERS_MATERIAL.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...FUN_MAGIC_SHADERS.map(p => ({ ...p, url: createMatCap(p.generate) })),
  ...TOON_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...FLAT_COLOR_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...GLASS_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...BRIGHT_COLOR_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...METAL_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...CLAY_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p),
  ...GEMS_PRESETS.map(p => p.generate ? { ...p, url: createMatCap(p.generate) } : p)
];

export const PRESET_CATEGORIES = [
  'All',
  '🎨 Blobmixer MatCaps',
  '☀️ Summer Afternoon',
  '🌿 Godot Water & Grass',
  '🌍 Wonderlust',
  '🍃 Wayfinder & Grassworks',
  '⚡ WebGPU & Cyber',
  '🌊 Live Desktop Shaders',
  '✨ Fun & Magic',
  'Toon Shaders',
  'Flat Colors',
  'Glass & Crystal',
  'Bright Colors',
  'Metals',
  'Clay & Matte',
  'Gems & Organics'
];
