// 🌊 11 LIVE DESKTOP SHADERS
// Enhanced with Seamless 3D Mapping to eliminate UV seams on complex models like Suzanne
// Supports:
//  0.0: Seamless MatCap (View Normal - No Seams)
//  1.0: Seamless 3D Object (Mesh Position - No Seams)
//  2.0: Screen Space (Holographic Window - No Seams)
//  3.0: Model UV Map (Standard Unwrapped)

export const DESKTOP_VERTEX_SHADER = `precision mediump float;
varying vec2 v_uv;
varying vec2 v_view_uv;
varying vec3 v_obj_pos;
varying vec3 v_normal;
varying vec3 v_position;

void main() {
  v_uv = uv;
  v_obj_pos = position;
  v_normal = normalize(normalMatrix * normal);
  v_view_uv = v_normal.xy * 0.5 + 0.5;
  vec4 mv_pos = modelViewMatrix * vec4(position, 1.0);
  v_position = mv_pos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const COORD_HELPER = `
uniform float u_mapping;
varying vec2 v_uv;
varying vec2 v_view_uv;
varying vec3 v_obj_pos;
varying vec3 v_normal;

vec2 getCoords() {
    if (u_mapping > 2.5) {
        return v_uv;
    } else if (u_mapping > 1.5) {
        return gl_FragCoord.xy / iResolution.xy;
    } else if (u_mapping > 0.5) {
        if (abs(v_normal.z) > 0.99 && length(v_normal.xy) < 0.02) return v_uv;
        return vec2(v_obj_pos.x * 0.38 + 0.5, v_obj_pos.y * 0.45 + 0.5);
    } else {
        if (abs(v_normal.z) > 0.99 && length(v_normal.xy) < 0.02) return v_uv;
        return v_view_uv;
    }
}
`;

export const DESKTOP_SHADERS_MATERIAL = [
  {
    id: 'live_toon_water_07',
    name: 'Toon Water Ripples',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Layered dual-octave FBM animated toon water ripples, dynamic crest foam, and vibrant gradient aqua.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#00d2d3');
      grad.addColorStop(0.5, '#0984e3');
      grad.addColorStop(1, '#074278');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(w/2, h * (0.3 + i * 0.18), w * 0.35, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
uniform vec3 u_tint;
` + COORD_HELPER + `
#define white vec3(1.0)

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h * h * h * h * vec3(
        dot(a, hash(i + 0.0)),
        dot(b, hash(i + o)),
        dot(c, hash(i + 1.0))
    );
    return dot(n, vec3(70.0));
}

float fbm(vec2 p){
    float a = 0.5;
    float n = 0.0;
    for(float i = 0.0; i < 4.0; i++){
        n += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return n;
}

void main() {
    float T = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = getCoords();
    vec3 col = mix(vec3(0.11, 0.86, 0.98), vec3(0.04, 0.35, 0.96), 1.0 - uv.y);

    float n1 = abs(fbm(uv * 4.0 + vec2(0.0, T * 0.5)) - noise(uv * 2.0 + vec2(0.0, T * 1.2)) * 0.8);
    float v = 0.05;
    float feath = 0.05;
    float s = smoothstep(v + feath, v, n1);
    col = mix(col, white, s * 0.5);

    float n2 = abs(fbm(uv * 3.0 + vec2(0.0, T * 0.2) + vec2(0.1)) - noise(uv * 2.0 + vec2(0.0, T * 0.8)) * 0.5);
    float v2 = 0.04;
    float s2 = smoothstep(v2 + feath, v2, n2);
    col = mix(col, white, s2 * 0.3);

    float d = uv.y - sin(uv.x * 10.0) / 15.0 - n1 * 0.5;
    float s3 = smoothstep(0.1, 0.09, d);
    col = mix(col, white, s3 * 0.6);

    gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'live_galaxy_fractal',
    name: 'Parallax Fractal Galaxy',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Multi-layer Kaliset fractal galaxy with parallax cosmic depth, starfield sparkles, and harmonic pulsation.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w/2);
      grad.addColorStop(0, '#f368e0');
      grad.addColorStop(0.35, '#5f27cd');
      grad.addColorStop(0.7, '#0a0026');
      grad.addColorStop(1, '#02000a');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(255, 235, 150, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.1) {
        const r = a * 15;
        const x = w/2 + Math.cos(a) * r;
        const y = h/2 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

float field(in vec3 p, float s, float t) {
    float strength = 7.0 + 0.03 * log(1.e-6 + fract(sin(t) * 4373.11));
    float accum = s / 4.0;
    float prev = 0.0;
    float tw = 0.0;
    for (int i = 0; i < 26; ++i) {
        float mag = dot(p, p);
        p = abs(p) / mag + vec3(-0.5, -0.4, -1.5);
        float w = exp(-float(i) / 7.0);
        accum += w * exp(-strength * pow(abs(mag - prev), 2.2));
        tw += w;
        prev = mag;
    }
    return max(0.0, 5.0 * accum / tw - 0.7);
}

float field2(in vec3 p, float s, float t) {
    float strength = 7.0 + 0.03 * log(1.e-6 + fract(sin(t) * 4373.11));
    float accum = s / 4.0;
    float prev = 0.0;
    float tw = 0.0;
    for (int i = 0; i < 18; ++i) {
        float mag = dot(p, p);
        p = abs(p) / mag + vec3(-0.5, -0.4, -1.5);
        float w = exp(-float(i) / 7.0);
        accum += w * exp(-strength * pow(abs(mag - prev), 2.2));
        tw += w;
        prev = mag;
    }
    return max(0.0, 5.0 * accum / tw - 0.7);
}

vec3 nrand3(vec2 co) {
    vec3 a = fract(cos(co.x * 8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));
    vec3 b = fract(sin(co.x * 0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));
    return mix(a, b, 0.5);
}

float getFreq(float x, float t) {
    return clamp(sin(t * 2.0 + x * 10.0) * 0.3 + cos(t * 1.5 - x * 5.0) * 0.3 + 0.5, 0.0, 1.0);
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = (getCoords() * 2.0 - 1.0);
    vec3 p = vec3(uv / 2.0, 0.0) + vec3(1.0, -1.3, 0.0);
    p += 0.2 * vec3(sin(t / 16.0), sin(t / 12.0), sin(t / 128.0));

    float f0 = getFreq(0.01, t);
    float f1 = getFreq(0.07, t);
    float f2 = getFreq(0.15, t);
    float f3 = getFreq(0.30, t);

    float t1 = field(p, f2, t);
    float v = (1.0 - exp((abs(uv.x) - 1.0) * 6.0)) * (1.0 - exp((abs(uv.y) - 1.0) * 6.0));

    vec3 p2 = vec3(uv / (4.0 + sin(t * 0.11) * 0.2 + 0.2 + sin(t * 0.15) * 0.3 + 0.4), 1.5) + vec3(2.0, -1.3, -1.0);
    p2 += 0.25 * vec3(sin(t / 16.0), sin(t / 12.0), sin(t / 128.0));
    float t2 = field2(p2, f3, t);
    vec4 c2 = mix(0.4, 1.0, v) * vec4(1.3 * t2 * t2 * t2, 1.8 * t2 * t2, t2 * f0, t2);

    vec2 seed = floor(p.xy * 2.0 * 500.0);
    vec3 rnd = nrand3(seed);
    vec4 starcolor = vec4(pow(rnd.y, 40.0));

    vec4 finalColor = mix(f3 - 0.3, 1.0, v) * vec4(1.5 * f2 * t1 * t1 * t1, 1.2 * f1 * t1 * t1, f3 * t1, 1.0) + c2 + starcolor;
    gl_FragColor = vec4(finalColor.rgb, 1.0);
}`
  },
  {
    id: 'live_mystic_portal',
    name: 'Mystic Energy Portal',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Swirling concentric vortex rings with chromatic edge aberration, event horizon distortion, and pulsing core.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w/2, h/2, 5, w/2, h/2, w/2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#00d2d3');
      grad.addColorStop(0.5, '#5f27cd');
      grad.addColorStop(0.85, '#1e0847');
      grad.addColorStop(1, '#05010f');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(0, 210, 211, 0.75)';
      ctx.lineWidth = 4;
      for (let r = 40; r < w/2; r += 35) {
        ctx.beginPath();
        ctx.arc(w/2, h/2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

float hash12(vec2 p) {
    vec3 p3 = fract(p.xyx * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float res = mix(
        mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
        mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0)), f.x), f.y);
    return res * res;
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = (getCoords() * 2.0 - 1.0);

    float l = sqrt(length(uv));
    float a = l * 9.0 - t;

    uv = cos(-uv.x + a) * uv + sin(a) * vec2(-uv.y, uv.x);

    float n = sqrt(noise(uv * 6.0));
    float b = noise(35.185 - uv * 8.0);
    float c = 1.0 / (b + 1.0);
    float s = smoothstep(0.3, 0.6 * c, n * (1.25 - l * l));
    float d = sin(6.0 * n * b) * 0.5 + 0.5;

    vec3 c1 = cos(vec3(s * n, n * n, d - s) * 8.0 - b) * 0.5 + 0.5;
    vec3 c2 = sin((vec3(s - b, -n, n)) * 6.0);
    vec3 c3 = sin(vec3(b, b, d) * 2.0 / (0.2 + l));

    vec3 col = c1 * s;
    col += (1.0 - s) * c2 * smoothstep(0.2, 0.4, b * (1.1 - l * l));
    col += mix((1.0 - l) * c3 * l, (0.8 - l) * c3 * l, l);
    col = clamp(col, vec3(0.0), vec3(1.0));

    gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'live_mind_flowers',
    name: 'Mind Flowers Mandala',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Hypnotic kaleidoscope sacred geometry portal with blooming psychedelic mandalas and color cycling.',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#08020f';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      const colors = ['#ff9ff3', '#feca57', '#ff6b6b', '#48dbfb', '#1dd1a1'];
      for (let layer = 0; layer < 5; layer++) {
        ctx.strokeStyle = colors[layer];
        ctx.lineWidth = 3;
        const petals = 8 + layer * 2;
        const rad = 25 + layer * 25;
        for (let i = 0; i < petals; i++) {
          const ang = (i / petals) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(w/2 + Math.cos(ang) * rad, h/2 + Math.sin(ang) * rad, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

#define TIME (iTime * (u_speed > 0.0 ? u_speed : 1.0))
#define PI 3.141592654
#define TAU (2.0*PI)
#define PI_2 (0.5*PI)
#define BPM 33.0

const float planeDist = 0.20;
const int furthest = 16;
const int fadeFrom = 12;
const float fadeDist = 0.80;

const float ringDistance = 0.075;
const float glowFactor = 0.05;

vec4 alphaBlend(vec4 back, vec4 front) {
    float w = front.w + back.w * (1.0 - front.w);
    vec3 xyz = (front.xyz * front.w + back.xyz * back.w * (1.0 - front.w)) / max(w, 0.0001);
    return w > 0.0 ? vec4(xyz, w) : vec4(0.0);
}

float hash(float co) {
    return fract(sin(co * 12.9898) * 13758.5453);
}

vec3 offset(float z) {
    float a = z;
    vec2 p = -0.15 * (vec2(cos(a), sin(a * sqrt(2.0))) + vec2(cos(a * sqrt(0.75)), sin(a * sqrt(0.5))));
    return vec3(p, z);
}

vec3 doffset(float z) {
    float eps = 0.05;
    return 0.5 * (offset(z + eps) - offset(z - eps)) / (2.0 * eps);
}

vec3 ddoffset(float z) {
    float eps = 0.05;
    return 0.5 * (doffset(z + eps) - doffset(z - eps)) / (2.0 * eps);
}

float mod1(inout float p, float size) {
    float halfsize = size * 0.5;
    float c = floor((p + halfsize) / size);
    p = mod(p + halfsize, size) - halfsize;
    return c;
}

float atan_approx(float y, float x) {
    float cosatan2 = x / (abs(x) + abs(y) + 1e-6);
    float t = PI_2 - cosatan2 * PI_2;
    return y < 0.0 ? -t : t;
}

vec2 toPolar(vec2 p) {
    return vec2(length(p), atan_approx(p.y, p.x));
}

vec3 glow(vec2 pp, float h) {
    float hh = fract(h * 8677.0);
    float b = TAU * h + 0.5 * TIME * (hh > 0.5 ? 1.0 : -1.0);
    float a = pp.y + b;
    float d = max(abs(pp.x) - 0.001, 0.00125);
    return (smoothstep(0.667 * ringDistance, 0.2 * ringDistance, d) *
           mix(vec3(1.0), sin(vec3(0.0, 1.0, 2.0) + a * 3.0) * 0.5 + 0.5, 0.75) +
           glowFactor * ringDistance / d * sin(vec3(3.0, 2.0, 1.0) + a * 3.0) * 0.5 + 0.5) *
           exp(-10.0 * pp.x);
}

vec4 plane(vec3 ro, vec3 rd, vec3 pp, float h) {
    float l = length(pp - ro);
    vec2 p = pp.xy;
    p = toPolar(p);
    float h2 = mod1(p.x, ringDistance);
    vec3 col = glow(p, h + h2);
    float t = smoothstep(fadeDist, 0.0, l - float(fadeFrom) * planeDist);
    return vec4(col, t);
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
    vec3 rd = normalize(p.x * uu + p.y * vv + 2.0 * ww);
    float nz = floor(ro.z / planeDist);
    vec4 acol = vec4(0.0);
    for (int i = 1; i <= furthest; ++i) {
        float z = float(i) * planeDist + nz * planeDist;
        vec3 pp = ro + rd * (z - ro.z) / rd.z;
        float h = hash(z);
        vec4 col = plane(ro, rd, pp, h);
        acol = alphaBlend(col, acol);
    }
    return acol.xyz;
}

vec3 effect(vec2 p) {
    float tm = planeDist * TIME * BPM / 60.0;
    vec3 ro = offset(tm);
    vec3 dro = doffset(tm);
    vec3 ddro = ddoffset(tm);
    vec3 ww = normalize(dro);
    vec3 uu = normalize(cross(normalize(vec3(0.0, 1.0, 0.0) + ddro), ww));
    vec3 vv = cross(ww, uu);
    vec3 col = color(ww, uu, vv, ro, p);
    col -= 0.075 * vec3(2.0, 3.0, 1.0);
    col *= sqrt(2.0);
    col = clamp(col, 0.0, 1.0);
    col = sqrt(col);
    return col;
}

void main() {
    vec2 p = -1.0 + 2.0 * getCoords();
    vec3 col = effect(p);
    gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'live_simplicity_space',
    name: 'Simplicity Galaxy Nebula',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Volumetric Kaliset nebula clouds with interactive dispersion, twinkling stars, and deep cosmic violet hues.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w/2);
      grad.addColorStop(0, '#22a6b3');
      grad.addColorStop(0.4, '#30336b');
      grad.addColorStop(0.75, '#130f40');
      grad.addColorStop(1, '#05021a');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffbe76';
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

const int MAX_ITER = 18;

float field(vec3 p, float s, int iter) {
    float accum = s / 4.0;
    float prev = 0.0;
    float tw = 0.0;
    for (int i = 0; i < MAX_ITER; ++i) {
        if (i >= iter) break;
        float mag = dot(p, p);
        p = abs(p) / mag + vec3(-0.5, -0.4, -1.487);
        float w = exp(-float(i) / 5.0);
        accum += w * exp(-9.025 * pow(abs(mag - prev), 2.2));
        tw += w;
        prev = mag;
    }
    return max(0.0, 5.2 * accum / tw - 0.65);
}

vec3 nrand3(vec2 co) {
    vec3 a = fract(cos(co.x * 8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));
    vec3 b = fract(sin(co.x * 0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));
    return mix(a, b, 0.5);
}

vec4 starLayer(vec2 p, float time) {
    vec2 seed = 1.9 * p.xy;
    seed = floor(seed * 400.0);
    vec3 rnd = nrand3(seed);
    vec4 col = vec4(pow(rnd.y, 17.0));
    float mul = 10.0 * rnd.x;
    col.xyz *= sin(time * mul + mul) * 0.25 + 1.0;
    return col;
}

void main() {
    float time = (iTime * (u_speed > 0.0 ? u_speed : 1.0)) * 0.8;
    vec2 uv = (getCoords() * 2.0 - 1.0);
    vec3 p = vec3(uv / 2.5, 0.0) + vec3(0.8, -1.3, 0.0);
    p += 0.45 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));

    float freqs[4];
    freqs[0] = 0.45;
    freqs[1] = 0.40;
    freqs[2] = 0.15;
    freqs[3] = 0.90;

    float t = field(p, freqs[2], 13);
    float v = (1.0 - exp((abs(uv.x) - 1.0) * 6.0)) * (1.0 - exp((abs(uv.y) - 1.0) * 6.0));

    vec3 p2 = vec3(uv / (4.0 + sin(time * 0.11) * 0.2 + 0.2 + sin(time * 0.15) * 0.3 + 0.4), 4.0) + vec3(2.0, -1.3, -1.0);
    p2 += 0.16 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));
    float t2 = field2(p2, freqs[3], 18);
    vec4 c2 = mix(0.4, 1.0, v) * vec4(1.3 * t2 * t2 * t2, 1.8 * t2 * t2, t2 * freqs[0], t2);

    vec4 starcolor = starLayer(p.xy, time);
    vec4 starcolor2 = starLayer(p2.xy, time * 0.8);

    vec4 colour = mix(freqs[3] - 0.3, 1.0, v) * vec4(1.5 * freqs[2] * t * t * t, 1.2 * freqs[1] * t * t, freqs[3] * t, 1.0) + c2 + starcolor + starcolor2;
    gl_FragColor = vec4(colour.rgb, 1.0);
}`
  },
  {
    id: 'live_ocean_sunset',
    name: 'Sunset Over Ocean',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Stylized retro sunset with banded gradient evening sky, radiant sun disc, and rhythmic ocean wave glints.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#eb4d4b');
      grad.addColorStop(0.4, '#f0932b');
      grad.addColorStop(0.55, '#f9ca24');
      grad.addColorStop(0.56, '#30336b');
      grad.addColorStop(1, '#130f40');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w/2, h * 0.52, w * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 235, 120, 0.7)';
      for (let i = 1; i <= 6; i++) {
        const y = h * (0.58 + i * 0.06);
        const rw = w * (0.35 - i * 0.04);
        ctx.fillRect(w/2 - rw/2, y, rw, 4);
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

float cnoise(in vec2 uv) {
    const mat2 r = mat2(-0.1288, -0.9917, 0.9917, -0.1288);
    vec2 s0 = cos(uv);
    vec2 s1 = cos(uv * 2.5 * r);
    vec2 s2 = cos(uv * 4.0 * r * r);
    vec2 s = s0 * s1 * s2;
    return (s.x + s.y) * 0.25 + 0.5;
}

#define S(x) (smoothstep(0.0, 1.0, (x)))

float fin(in vec2 uv, float t) {
    uv.x += S(S(S(abs(1.0 - 2.0 * fract(t * 0.02))))) - 0.5;
    uv *= vec2(sign(abs(1.0 - 2.0 * fract(t * 0.02 + 0.25)) - 0.5), 1.0) * 3.5;
    float d = smoothstep(0.003, 0.0,
                         uv.y + 2.0 * uv.x * uv.x + max(0.0, -(uv.y + 0.3) * (uv.y + 0.3) + uv.x * 3.0) * 5.0);
    return 1.0 - d * smoothstep(-0.4, -0.394, uv.y + sin(t * 4.0 - uv.x * 16.0) / 100.0);
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = (getCoords() - 0.5) * 1.5;

    float avg = 0.0;
    avg += (cnoise(uv * vec2(0.5, 20.0) + t) * 8.0 - 4.0);
    avg += (cnoise(uv * vec2(2.5, 60.0) + t) * 4.0 - 2.0);
    avg += (cnoise(uv * vec2(5.0, 80.0) + t) * 2.0 - 1.0);
    avg += (cnoise(uv * vec2(10.0, 20.0) + t) * 2.0 - 1.0);
    avg /= 4.0;

    vec2 st = vec2(uv.x, uv.y + clamp(avg * smoothstep(0.1, -1.0, uv.y), -0.1, 0.1));

    vec3 col = mix(vec3(0.85, 0.55, 0.0),
                   vec3(0.90, 0.40, 0.0),
                   sqrt(abs(st.y * st.y * st.y)) * 28.0) * fin(uv, t)
                   * smoothstep(0.25 + 0.01, 0.25, length(st))
                   + smoothstep(2.0, 0.5, length(uv)) * 0.1;

    gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'live_toon_beach',
    name: 'Toon Beach & Waves',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Stylized anime shoreline with rhythmic rolling wave surf, animated foam boundary, and golden sand.',
    generate: (ctx, w, h) => {
      ctx.fillStyle = '#00cec9';
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#f6e58d';
      ctx.beginPath();
      ctx.arc(w/2, h/2, w/2, 0, Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, h/2);
      ctx.quadraticCurveTo(w * 0.25, h * 0.45, w * 0.5, h * 0.5);
      ctx.quadraticCurveTo(w * 0.75, h * 0.55, w, h * 0.5);
      ctx.stroke();
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

#define PI 3.14159265359

float plotFoam(vec2 st, float pct, float t){
    return step(pct + 0.06, st.y) - step(pct + 0.08 + abs(sin(t * 0.25) * 0.3), st.y);
}

float plotSand(vec2 st, float pct){
    return step(pct + 0.08, st.y);
}

float plotSea(vec2 st, float pct){
    return step(pct - 0.7, st.y) - step(pct + 0.06, st.y);
}

float plotDeepSea(vec2 st, float pct){
    return 1.0 - step(pct - 0.7, st.y);
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 st = getCoords();
    float y = sin(t * 0.5) * 0.4 + sin(PI * 8.0 * st.x) * 0.02 + st.x - 0.2;

    float foam = plotFoam(st, y, t);
    float sand = plotSand(st, y);
    float sea = plotSea(st, y);
    float deepSea = plotDeepSea(st, y);

    vec3 color = sea * vec3(0.0, 0.8, 1.0) +
                 foam * vec3(1.0) +
                 sand * vec3(1.0, 0.8, 0.2) +
                 deepSea * vec3(0.2, 0.3, 0.8);

    gl_FragColor = vec4(color, 1.0);
}`
  },
  {
    id: 'live_toon_clouds',
    name: 'Procedural Toon Clouds',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Layered drifting Ghibli-style cumulus clouds with fluffy volumetric contour edges over a sunny summer sky.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0abde3');
      grad.addColorStop(1, '#c8d6e5');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      const drawCloud = (cx, cy, r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.arc(cx - r*0.6, cy + r*0.2, r*0.7, 0, Math.PI * 2);
        ctx.arc(cx + r*0.7, cy + r*0.1, r*0.75, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCloud(w * 0.45, h * 0.45, 45);
      drawCloud(w * 0.65, h * 0.65, 35);
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 x){
    vec2 f = fract(x);
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    vec2 p = floor(x);
    float a = hash(p + vec2(0.0, 0.0));
    float b = hash(p + vec2(1.0, 0.0));
    float c = hash(p + vec2(0.0, 1.0));
    float d = hash(p + vec2(1.0, 1.0));
    return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

#define OCTAVES 6
float fbm(vec2 x){
    float a = 0.0;
    float b = 1.0;
    float t = 0.0;
    for(int i = 0; i < OCTAVES; i++){
        float n = noise(x);
        a += b * n;
        t += b;
        b *= 0.7;
        x *= 1.7; 
    }
    return a / t;
}

vec4 layer(vec2 uv, float h, float s, float t){
    float speed = 0.03 * s;
    float x = fbm(vec2(uv.x * 2.0 + t * speed, h));
    float c = fbm(vec2(x * 3.0 + t * speed, h));
    
    vec4 C = vec4(1.0);
    float n = uv.y - c * 0.3 - h;
    
    float a = smoothstep(0.0, 0.02, -n);
    C.a = a;
    
    float s1 = smoothstep(0.0, 0.02, -(n - 0.03));
    float s2 = smoothstep(0.0, 0.02, -(n - 0.06));
    
    C.rgb = mix(vec3(0.9, 0.95, 1.0), vec3(0.7, 0.78, 0.92), s1);
    C.rgb = mix(C.rgb, vec3(0.5, 0.58, 0.8), s2);
    
    return C;
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = getCoords();
    vec3 sky = mix(vec3(0.35, 0.65, 0.95), vec3(0.7, 0.85, 1.0), uv.y);
    vec4 col = vec4(sky, 1.0);

    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec4 cl = layer(uv, 0.2 + fi * 0.18, 1.0 + fi * 0.4, t);
        col.rgb = mix(col.rgb, cl.rgb, cl.a);
    }

    gl_FragColor = vec4(col.rgb, 1.0);
}`
  },
  {
    id: 'live_toon_water_voronoi',
    name: 'Toon Voronoi Water',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Animated caustic Voronoi cell network with specular water peaks, crystal aqua lagoon refraction, and foam.',
    generate: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w/2);
      grad.addColorStop(0, '#55efc4');
      grad.addColorStop(0.4, '#00cec9');
      grad.addColorStop(0.8, '#0984e3');
      grad.addColorStop(1, '#074278');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      const pts = [
        [w*0.3, h*0.3], [w*0.7, h*0.25], [w*0.5, h*0.55],
        [w*0.25, h*0.75], [w*0.75, h*0.7]
      ];
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
        }
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

float hash1(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoi(in vec2 x, float w, float offset, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float m = 8.0;
    for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);
            o = offset + 0.3 * sin(t + 6.2831 * o + x);
            float d = length(g - f + o);
            float h = smoothstep(-1.0, 1.0, (m - d) / w);
            m = mix(m, d, h) - h * (1.0 - h) * w / (1.0 + 3.0 * w);
        }
    }
    return m;
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 uv = getCoords() * 4.0;
    uv.x += t * 0.5;
    uv.y += t * 0.25;

    vec4 a = vec4(0.114, 0.635, 0.847, 1.0);
    vec4 b = vec4(1.0, 1.0, 1.0, 1.0);
    vec4 c = a * 0.8;

    float vNoise = voronoi(uv, 0.001, 0.5, t);
    float sNoise = voronoi(uv, 0.4, 0.5, t);
    float fVoronoi = smoothstep(0.0, 0.01, vNoise - sNoise);

    float vNoise2 = voronoi(uv, 0.001, 0.3, t);
    float sNoise2 = voronoi(uv, 0.4, 0.3, t);
    float offsetVoronoi = smoothstep(0.0, 0.01, vNoise2 - sNoise2);

    float pi = 3.14159265359;
    float wave = (sin(pi * (uv.x + uv.y)) + 1.0) / 2.0;

    vec4 bgColor2 = mix(a, c, offsetVoronoi + wave);
    vec4 finalVoronoi = mix(bgColor2, b, fVoronoi);

    gl_FragColor = vec4(finalVoronoi.rgb, 1.0);
}`
  },
  {
    id: 'live_toon_water_flow',
    name: 'Stylized Water Flow',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Smooth multi-octave flowing water currents with directional wave noise and stylized specular surface foam.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#2e86de');
      grad.addColorStop(0.5, '#54a0ff');
      grad.addColorStop(1, '#00d2d3');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 4;
      for (let y = h * 0.2; y < h * 0.9; y += 30) {
        ctx.beginPath();
        ctx.moveTo(w * 0.15, y);
        ctx.bezierCurveTo(w * 0.35, y - 20, w * 0.65, y + 20, w * 0.85, y);
        ctx.stroke();
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

#define NUM_NOISE_OCTAVES 2

float hash(float n) { return fract(sin(n) * 1e4); }
float hash(vec2 p, float t) {
    return (sin(t * 3.0) * 0.02) + fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

float noise(vec2 x, float t) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 x, float t) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_NOISE_OCTAVES; ++i) {
        v += a * noise(x, t);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    float t = iTime * (u_speed > 0.0 ? u_speed : 1.0);
    vec2 coord = getCoords() * 4.0;
    coord.x += t * 0.2;

    float wave = fbm(coord, t);
    float foam = smoothstep(0.48, 0.52, wave);

    vec3 deepWater = vec3(0.05, 0.35, 0.75);
    vec3 shallowWater = vec3(0.2, 0.7, 0.9);
    vec3 foamColor = vec3(1.0, 1.0, 1.0);

    vec3 col = mix(deepWater, shallowWater, wave);
    col = mix(col, foamColor, foam * 0.7);

    gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'live_waterfall_toon',
    name: 'Waterfall Toon Waves',
    category: '🌊 Live Desktop Shaders',
    type: 'shader',
    description: 'Cascading stylized waterfall rapids with froth crests, foaming water spray bursts, and emerald-mint gradients.',
    generate: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#10ac84');
      grad.addColorStop(0.5, '#1dd1a1');
      grad.addColorStop(1, '#00d2d3');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 15; i++) {
        const x = w * (0.2 + (i % 5) * 0.15);
        const y = h * (0.15 + Math.floor(i / 5) * 0.28);
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    vertexShader: DESKTOP_VERTEX_SHADER,
    fragmentShader: `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float u_speed;
` + COORD_HELPER + `

#define T (iTime * (u_speed > 0.0 ? u_speed : 1.0))

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h * h * h * h * vec3(
        dot(a, hash(i + 0.0)),
        dot(b, hash(i + o)),
        dot(c, hash(i + 1.0))
    );
    return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
    float a = 0.5;
    float n = 0.0;
    for(float i = 0.0; i < 4.0; i++) {
        n += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return n;
}

void main() {
    vec2 uv = getCoords() * 2.0;
    vec3 col = vec3(0.69, 0.80, 0.54);

    float n = noise(uv * vec2(12.0, 1.0) + vec2(0.0, T * 1.5));
    float s = smoothstep(0.2, 0.1, abs(n));
    col = mix(col, vec3(0.81, 0.93, 0.66), s);

    n = noise(uv * vec2(6.0, 0.5) + vec2(0.0, T));
    float d1 = uv.y - 0.4 + n * 0.6;
    float s1 = smoothstep(0.2, 0.1, d1);
    col = mix(col, vec3(0.557, 0.627, 0.475), s1);

    float d = abs(uv.y - sin(30.0 * uv.x + T * 3.0) / 20.0 - 0.7);
    float sh = smoothstep(0.2, 0.0, d);
    sh *= n * smoothstep(0.0, 0.5, sin(uv.x * 6.0 - 2.0));
    sh = smoothstep(0.1, 0.2, sh);
    col = mix(col, vec3(1.0, 1.0, 0.85), sh);

    float n2 = fbm(uv + T * 0.4);
    float d2 = uv.y - sin(uv.x * 5.0 + T * 5.0) / 25.0 - n2 * 0.1;
    float s2 = smoothstep(0.1, 0.0, d2);
    col = mix(col, vec3(0.76, 0.86, 0.67), s2);

    gl_FragColor = vec4(col, 1.0);
}`
  }
];

export const DESKTOP_SHADERS_CREATOR = DESKTOP_SHADERS_MATERIAL.map(item => ({
  id: item.id,
  name: item.name,
  category: '🌊 Live Desktop Shaders',
  description: item.description,
  vertexShader: item.vertexShader,
  fragmentShader: item.fragmentShader,
  uniforms: {
    u_speed: { type: 'range', label: 'Animation Speed', value: 1.0, min: 0.1, max: 3.0, step: 0.1 }
  }
}));


export const DESKTOP_SHADERS_EXTRACTED = [
  {
    "name": "desktop-live_toon_water_07",
    "path": "desktop-shaders/TOON WATER 07------add.html",
    "title": "Toon Water Ripples",
    "files": {
      "TOON WATER 07------add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Shadertoy with Free Camera Control</title>\n  <style>\n    html, body {\n      margin: 0;\n      padding: 0;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n      background-color: #000;\n    }\n    canvas {\n      width: 100%;\n      height: 100%;\n      display: block;\n      cursor: grab;\n    }\n    canvas:active {\n      cursor: grabbing;\n    }\n  </style>\n</head>\n<body>\n  <canvas id=\"glcanvas\"></canvas>\n\n  <script>\n    const canvas = document.getElementById('glcanvas');\n    const gl = canvas.getContext('webgl2');\n\n    if (!gl) {\n      alert('WebGL 2 not supported by your browser.');\n    }\n\n    // Vertex Shader\n    const vsSource = `#version 300 es\n    in vec2 position;\n    void main() {\n        gl_Position = vec4(position, 0.0, 1.0);\n    }\n    `;\n\n    // Fragment Shader containing your custom code + free camera transformation\n    const fsSource = `#version 300 es\n    precision highp float;\n\n    uniform vec3 iResolution;\n    uniform float iTime;\n    uniform vec2 iCamOffset;\n    uniform float iCamZoom;\n\n    out vec4 fragColor;\n\n    #define T iTime\n    #define white vec3(1)\n\n    vec2 hash(vec2 p) {\n        p = vec2(dot(p, vec2(127.1, 311.7)),\n                 dot(p, vec2(269.5, 183.3)));\n        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);\n    }\n\n    float noise(vec2 p) {\n        const float K1 = 0.366025404; // (sqrt(3)-1)/2\n        const float K2 = 0.211324865; // (3-sqrt(3))/6\n\n        vec2 i = floor(p + (p.x + p.y) * K1);\n        vec2 a = p - i + (i.x + i.y) * K2;\n        vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n        vec2 b = a - o + K2;\n        vec2 c = a - 1.0 + 2.0 * K2;\n\n        vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);\n\n        vec3 n = h * h * h * h * vec3(\n            dot(a, hash(i + 0.0)),\n            dot(b, hash(i + o)),\n            dot(c, hash(i + 1.0))\n        );\n\n        return dot(n, vec3(70.0));\n    }\n\n    float fbm(vec2 p){\n      float a = .5;\n      float n = 0.;\n\n      for(float i=0.;i<4.;i++){\n        n += a * noise(p);\n        p *= 2.;\n        a *= .5;\n      }\n      return n;\n    }\n\n    void mainImage(out vec4 O, in vec2 I){\n      vec2 R = iResolution.xy;\n      \n      // Apply free camera zoom and pan transformation\n      vec2 center = R * 0.5;\n      vec2 transformedPos = (I - center) / iCamZoom + center + iCamOffset;\n\n      vec2 uv = transformedPos / R.y;\n      O.rgb = mix(vec3(0.11,0.86,0.98), vec3(0.04,0.35,0.96), 1.-uv.y);\n      O.a = 1.;\n\n      // \u9876\u5c42\u6d9f\u6f2a\n      float n1 = abs(fbm(uv*2.+vec2(0,T*0.5))-noise(uv+vec2(0,T*1.2))*.8);\n      float v = 0.05;\n      float feath = 0.05;\n      float s = smoothstep(v+feath,v,n1);\n      O.rgb = mix(O.rgb, white, s*0.5);\n\n      // \u5e95\u5c42\u6d9f\u6f2a\n      float n2 = abs(fbm(uv*1.5+vec2(0,T*0.2)+vec2(.1))-noise(uv+vec2(0,T*.8))*0.5);\n      v = 0.04;\n      feath = 0.05;\n      s = smoothstep(v+feath,v,n2);\n      O.rgb = mix(O.rgb, white, s*0.3);\n\n      // \u5927\u7684\u9ad8\u4eae\n      float d = uv.y-sin(uv.x*10.)/15.-n1*.5;\n      s = smoothstep(0.1,0.09,d);\n      O.rgb = mix(O.rgb, white, s*0.6);\n    }\n\n    void main() {\n        mainImage(fragColor, gl_FragCoord.xy);\n    }\n    `;\n\n    function createShader(gl, type, source) {\n      const shader = gl.createShader(type);\n      gl.shaderSource(shader, source);\n      gl.compileShader(shader);\n      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n        console.error(gl.getShaderInfoLog(shader));\n        gl.deleteShader(shader);\n        return null;\n      }\n      return shader;\n    }\n\n    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n    const program = gl.createProgram();\n    gl.attachShader(program, vertexShader);\n    gl.attachShader(program, fragmentShader);\n    gl.linkProgram(program);\n\n    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n      console.error(gl.getProgramInfoLog(program));\n    }\n\n    const positionBuffer = gl.createBuffer();\n    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n      -1, -1,\n       1, -1,\n      -1,  1,\n      -1,  1,\n       1, -1,\n       1,  1,\n    ]), gl.STATIC_DRAW);\n\n    const positionLocation = gl.getAttribLocation(program, 'position');\n    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');\n    const timeLocation = gl.getUniformLocation(program, 'iTime');\n    const camOffsetLocation = gl.getUniformLocation(program, 'iCamOffset');\n    const camZoomLocation = gl.getUniformLocation(program, 'iCamZoom');\n\n    // Camera state variables\n    let camOffset = [0.0, 0.0];\n    let camZoom = 1.0;\n    let isDragging = false;\n    let previousMousePosition = { x: 0, y: 0 };\n\n    // Mouse Controls\n    canvas.addEventListener('mousedown', (e) => {\n      isDragging = true;\n      previousMousePosition = { x: e.clientX, y: e.clientY };\n    });\n\n    window.addEventListener('mousemove', (e) => {\n      if (!isDragging) return;\n      const deltaX = e.clientX - previousMousePosition.x;\n      const deltaY = e.clientY - previousMousePosition.y;\n\n      camOffset[0] -= deltaX / camZoom;\n      camOffset[1] += deltaY / camZoom;\n\n      previousMousePosition = { x: e.clientX, y: e.clientY };\n    });\n\n    window.addEventListener('mouseup', () => { isDragging = false; });\n\n    canvas.addEventListener('wheel', (e) => {\n      e.preventDefault();\n      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;\n      camZoom = Math.min(Math.max(camZoom * zoomFactor, 0.1), 10.0);\n    }, { passive: false });\n\n    // Touch Controls\n    let initialPinchDistance = null;\n\n    canvas.addEventListener('touchstart', (e) => {\n      if (e.touches.length === 1) {\n        isDragging = true;\n        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };\n      } else if (e.touches.length === 2) {\n        isDragging = false;\n        initialPinchDistance = Math.hypot(\n          e.touches[0].clientX - e.touches[1].clientX,\n          e.touches[0].clientY - e.touches[1].clientY\n        );\n      }\n    });\n\n    canvas.addEventListener('touchmove', (e) => {\n      if (isDragging && e.touches.length === 1) {\n        const deltaX = e.touches[0].clientX - previousMousePosition.x;\n        const deltaY = e.touches[0].clientY - previousMousePosition.y;\n\n        camOffset[0] -= deltaX / camZoom;\n        camOffset[1] += deltaY / camZoom;\n\n        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };\n      } else if (e.touches.length === 2 && initialPinchDistance) {\n        const currentDistance = Math.hypot(\n          e.touches[0].clientX - e.touches[1].clientX,\n          e.touches[0].clientY - e.touches[1].clientY\n        );\n        const factor = currentDistance / initialPinchDistance;\n        camZoom = Math.min(Math.max(camZoom * factor, 0.1), 10.0);\n        initialPinchDistance = currentDistance;\n      }\n    });\n\n    canvas.addEventListener('touchend', () => {\n      isDragging = false;\n      initialPinchDistance = null;\n    });\n\n    function resizeCanvas() {\n      const displayWidth  = window.innerWidth;\n      const displayHeight = window.innerHeight;\n\n      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {\n        canvas.width  = displayWidth;\n        canvas.height = displayHeight;\n        gl.viewport(0, 0, canvas.width, canvas.height);\n      }\n    }\n\n    function render(time) {\n      resizeCanvas();\n\n      gl.useProgram(program);\n\n      gl.enableVertexAttribArray(positionLocation);\n      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n      gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);\n      gl.uniform1f(timeLocation, time * 0.001);\n      gl.uniform2f(camOffsetLocation, camOffset[0], camOffset[1]);\n      gl.uniform1f(camZoomLocation, camZoom);\n\n      gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n      requestAnimationFrame(render);\n    }\n\n    requestAnimationFrame(render);\n  </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_galaxy_fractal",
    "path": "desktop-shaders/gemini-code-1786072398901 add.html",
    "title": "Parallax Fractal Galaxy",
    "files": {
      "gemini-code-1786072398901 add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Parallax Scrolling Fractal Galaxy</title>\n    <style>\n        body, html {\n            margin: 0;\n            padding: 0;\n            width: 100%;\n            height: 100%;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script id=\"vs\" type=\"x-shader/x-vertex\">\n        attribute vec2 position;\n        void main() {\n            gl_Position = vec4(position, 0.0, 1.0);\n        }\n    </script>\n\n    <script id=\"fs\" type=\"x-shader/x-fragment\">\n        precision highp float;\n        uniform vec3 iResolution;\n        uniform float iTime;\n        uniform sampler2D iChannel0;\n\n        // CBS\n        // Parallax scrolling fractal galaxy.\n        // Inspired by JoshP's Simplicity shader: https://www.shadertoy.com/view/lslGWr\n        // http://www.fractalforums.com/new-theories-and-research/very-simple-formula-for-fractal-patterns/\n\n        float field(in vec3 p, float s) {\n            float strength = 7. + .03 * log(1.e-6 + fract(sin(iTime) * 4373.11));\n            float accum = s / 4.;\n            float prev = 0.;\n            float tw = 0.;\n            for (int i = 0; i < 26; ++i) {\n                float mag = dot(p, p);\n                p = abs(p) / mag + vec3(-.5, -.4, -1.5);\n                float w = exp(-float(i) / 7.);\n                accum += w * exp(-strength * pow(abs(mag - prev), 2.2));\n                tw += w;\n                prev = mag;\n            }\n            return max(0., 5. * accum / tw - .7);\n        }\n\n        // Less iterations for second layer\n        float field2(in vec3 p, float s) {\n            float strength = 7. + .03 * log(1.e-6 + fract(sin(iTime) * 4373.11));\n            float accum = s / 4.;\n            float prev = 0.;\n            float tw = 0.;\n            for (int i = 0; i < 18; ++i) {\n                float mag = dot(p, p);\n                p = abs(p) / mag + vec3(-.5, -.4, -1.5);\n                float w = exp(-float(i) / 7.);\n                accum += w * exp(-strength * pow(abs(mag - prev), 2.2));\n                tw += w;\n                prev = mag;\n            }\n            return max(0., 5. * accum / tw - .7);\n        }\n\n        vec3 nrand3(vec2 co) {\n            vec3 a = fract(cos(co.x * 8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));\n            vec3 b = fract(sin(co.x * 0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));\n            vec3 c = mix(a, b, 0.5);\n            return c;\n        }\n\n        void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n            vec2 uv = 2. * fragCoord.xy / iResolution.xy - 1.;\n            vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);\n            vec3 p = vec3(uvs / 4., 0) + vec3(1., -1.3, 0.);\n            p += .2 * vec3(sin(iTime / 16.), sin(iTime / 12.), sin(iTime / 128.));\n            \n            float freqs[4];\n            // Sound sampling simulation\n            freqs[0] = texture2D(iChannel0, vec2(0.01, 0.25)).x;\n            freqs[1] = texture2D(iChannel0, vec2(0.07, 0.25)).x;\n            freqs[2] = texture2D(iChannel0, vec2(0.15, 0.25)).x;\n            freqs[3] = texture2D(iChannel0, vec2(0.30, 0.25)).x;\n\n            float t = field(p, freqs[2]);\n            float v = (1. - exp((abs(uv.x) - 1.) * 6.)) * (1. - exp((abs(uv.y) - 1.) * 6.));\n            \n            // Second Layer\n            vec3 p2 = vec3(uvs / (4. + sin(iTime * 0.11) * 0.2 + 0.2 + sin(iTime * 0.15) * 0.3 + 0.4), 1.5) + vec3(2., -1.3, -1.);\n            p2 += 0.25 * vec3(sin(iTime / 16.), sin(iTime / 12.), sin(iTime / 128.));\n            float t2 = field2(p2, freqs[3]);\n            vec4 c2 = mix(.4, 1., v) * vec4(1.3 * t2 * t2 * t2, 1.8 * t2 * t2, t2 * freqs[0], t2);\n            \n            // Stars\n            vec2 seed = p.xy * 2.0;    \n            seed = floor(seed * iResolution.x);\n            vec3 rnd = nrand3(seed);\n            vec4 starcolor = vec4(pow(rnd.y, 40.0));\n            \n            vec2 seed2 = p2.xy * 2.0;\n            seed2 = floor(seed2 * iResolution.x);\n            vec3 rnd2 = nrand3(seed2);\n            starcolor += vec4(pow(rnd2.y, 40.0));\n            \n            fragColor = mix(freqs[3] - .3, 1., v) * vec4(1.5 * freqs[2] * t * t * t, 1.2 * freqs[1] * t * t, freqs[3] * t, 1.0) + c2 + starcolor;\n        }\n\n        void main() {\n            mainImage(gl_FragColor, gl_FragCoord.xy);\n        }\n    </script>\n\n    <script>\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl');\n\n        if (!gl) {\n            alert('WebGL not supported');\n        }\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error(gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vsSource = document.getElementById('vs').text;\n        const fsSource = document.getElementById('fs').text;\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const positionLocation = gl.getAttribLocation(program, 'position');\n        const resolutionLocation = gl.getUniformLocation(program, 'iResolution');\n        const timeLocation = gl.getUniformLocation(program, 'iTime');\n        const channel0Location = gl.getUniformLocation(program, 'iChannel0');\n\n        // Synthetic Audio Texture Generator\n        const audioTexture = gl.createTexture();\n        gl.bindTexture(gl.TEXTURE_2D, audioTexture);\n        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);\n        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);\n        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);\n        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);\n\n        const audioData = new Uint8Array(512 * 2 * 4);\n\n        function updateAudioData(time) {\n            for (let i = 0; i < 512; i++) {\n                const x = i / 512;\n                // Generate procedural frequency values for frequencies[0..3]\n                const val = Math.sin(time * 2.0 + x * 10.0) * 0.3 + Math.cos(time * 1.5 - x * 5.0) * 0.3 + 0.5;\n                const byteVal = Math.floor(Math.max(0, Math.min(1, val)) * 255);\n                \n                audioData[i * 4] = byteVal;\n                audioData[i * 4 + 1] = byteVal;\n                audioData[i * 4 + 2] = byteVal;\n                audioData[i * 4 + 3] = 255;\n            }\n            gl.bindTexture(gl.TEXTURE_2D, audioTexture);\n            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, audioData);\n        }\n\n        function resize() {\n            canvas.width = window.innerWidth;\n            canvas.height = window.innerHeight;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n        window.addEventListener('resize', resize);\n        resize();\n\n        function render(time) {\n            time *= 0.001; // Convert to seconds\n\n            updateAudioData(time);\n\n            gl.useProgram(program);\n            gl.enableVertexAttribArray(positionLocation);\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(timeLocation, time);\n\n            gl.activeTexture(gl.TEXTURE0);\n            gl.bindTexture(gl.TEXTURE_2D, audioTexture);\n            gl.uniform1i(channel0Location, 0);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_mystic_portal",
    "path": "desktop-shaders/PORTAL (2) add.html",
    "title": "Mystic Energy Portal",
    "files": {
      "PORTAL (2) add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Interactive GLSL Shader</title>\n    <style>\n        body, html {\n            margin: 0;\n            padding: 0;\n            width: 100%;\n            height: 100%;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n            cursor: grab;\n        }\n        canvas:active {\n            cursor: grabbing;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl');\n\n        if (!gl) {\n            alert('WebGL not supported');\n        }\n\n        // Camera / Interaction State\n        let offset = { x: 0.0, y: 0.0 };\n        let zoom = 1.0;\n        let isDragging = false;\n        let lastMouse = { x: 0, y: 0 };\n\n        // Vertex Shader\n        const vsSource = `\n            attribute vec2 aPosition;\n            void main() {\n                gl_Position = vec4(aPosition, 0.0, 1.0);\n            }\n        `;\n\n        // Fragment Shader\n        const fsSource = `\n            precision highp float;\n\n            uniform vec2 iResolution;\n            uniform float iTime;\n            uniform vec2 iOffset;\n            uniform float iZoom;\n\n            float hash12(vec2 p) {\n                vec3 p3 = fract(p.xyx * 0.1031);\n                p3 += dot(p3, p3.yzx + 33.33);\n                return fract((p3.x + p3.y) * p3.z);\n            }\n\n            float noise(vec2 p) {\n                vec2 i = floor(p);\n                vec2 f = fract(p);\n                f = f * f * (3.0 - 2.0 * f);\n                float res = mix(\n                    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),\n                    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0)), f.x), f.y);\n                return res * res;    \n            }\n\n            void main() {\n                vec2 fragCoord = gl_FragCoord.xy;\n                \n                // Base aspect-corrected UVs\n                vec2 uv = (fragCoord * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);\n\n                // Apply interactive Camera transform (pan & zoom)\n                uv = (uv / iZoom) + iOffset;\n\n                float l = sqrt(length(uv));\n                float a = l * 9.0 - iTime;\n                \n                uv = cos(-uv.x + a) * uv + sin(a) * vec2(-uv.y, uv.x);\n                \n                float n = sqrt(noise(uv * 6.0));\n                float b = noise(35.185 - uv * 8.0);\n                float c = 1.0 / (b + 1.0);\n                float s = smoothstep(0.3, 0.6 * c, n * (1.25 - l * l));\n                float d = sin(6.0 * n * b) * 0.5 + 0.5;\n                \n                vec3 c1 = cos(vec3(s * n, n * n, d - s) * 8.0 - b) * 0.5 + 0.5;\n                vec3 c2 = sin((vec3(s - b, -n, n)) * 6.0);\n                vec3 c3 = sin(vec3(b, b, d) * 2.0 / (0.2 + l));\n\n                vec3 col = c1 * s;\n                col += (1.0 - s) * c2 * smoothstep(0.2, 0.4, b * (1.1 - l * l));\n                \n                col += mix((1.0 - l) * c3 * l, (0.8 - l) * c3 * l, l);\n                \n                col = clamp(col, vec3(0.0), vec3(1.0));\n\n                gl_FragColor = vec4(col, 1.0);\n            }\n        `;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compile error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program link error:', gl.getProgramInfoLog(program));\n        }\n\n        // Screen quad setup\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const aPosition = gl.getAttribLocation(program, 'aPosition');\n        const uResolution = gl.getUniformLocation(program, 'iResolution');\n        const uTime = gl.getUniformLocation(program, 'iTime');\n        const uOffset = gl.getUniformLocation(program, 'iOffset');\n        const uZoom = gl.getUniformLocation(program, 'iZoom');\n\n        function resizeCanvas() {\n            canvas.width = window.innerWidth;\n            canvas.height = window.innerHeight;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n        window.addEventListener('resize', resizeCanvas);\n        resizeCanvas();\n\n        // Mouse Controls\n        canvas.addEventListener('mousedown', (e) => {\n            isDragging = true;\n            lastMouse = { x: e.clientX, y: e.clientY };\n        });\n\n        window.addEventListener('mouseup', () => {\n            isDragging = false;\n        });\n\n        window.addEventListener('mousemove', (e) => {\n            if (!isDragging) return;\n\n            const dx = e.clientX - lastMouse.x;\n            const dy = e.clientY - lastMouse.y;\n\n            const minDim = Math.min(canvas.width, canvas.height);\n            // Convert pixel deltas into normalized camera coordinates taking scale into account\n            offset.x -= (dx * 2.0 / minDim) / zoom;\n            offset.y += (dy * 2.0 / minDim) / zoom;\n\n            lastMouse = { x: e.clientX, y: e.clientY };\n        });\n\n        canvas.addEventListener('wheel', (e) => {\n            e.preventDefault();\n            const zoomFactor = 1.05;\n            if (e.deltaY < 0) {\n                zoom *= zoomFactor;\n            } else {\n                zoom /= zoomFactor;\n            }\n            zoom = Math.max(0.1, Math.min(zoom, 100.0));\n        }, { passive: false });\n\n        // Render Loop\n        function render(time) {\n            time *= 0.001; // Convert to seconds\n\n            gl.useProgram(program);\n\n            gl.enableVertexAttribArray(aPosition);\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform2f(uResolution, canvas.width, canvas.height);\n            gl.uniform1f(uTime, time);\n            gl.uniform2f(uOffset, offset.x, offset.y);\n            gl.uniform1f(uZoom, zoom);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_mind_flowers",
    "path": "desktop-shaders/PORTAL 2 add.html",
    "title": "Mind Flowers Mandala",
    "files": {
      "PORTAL 2 add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Mind Flowers</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            overflow: hidden;\n        }\n        body, html {\n            width: 100%;\n            height: 100%;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl2');\n\n        if (!gl) {\n            console.error('WebGL 2 not supported by your browser.');\n            document.body.innerHTML = '<p style=\"color:white;text-align:center;padding-top:20px;\">WebGL 2 is not supported in this browser.</p>';\n        }\n\n        const vsSource = `#version 300 es\n            in vec2 position;\n            void main() {\n                gl_Position = vec4(position, 0.0, 1.0);\n            }\n        `;\n\n        const fsSource = `#version 300 es\n            precision highp float;\n\n            out vec4 fragColor;\n\n            uniform vec3 iResolution;\n            uniform float iTime;\n\n            #define RESOLUTION  iResolution\n            #define TIME        iTime\n            #define PI          3.141592654\n            #define PI_2        (0.5*PI)\n            #define TAU         (2.0*PI)\n            #define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))\n            #define BPM         (157.0/4.0)\n            #define PCOS(a)     0.5*(cos(a)+1.0)\n\n            const float planeDist = 1.0-0.80;\n            const int   furthest  = 16;\n            const int   fadeFrom  = max(furthest-4, 0);\n            const float fadeDist  = planeDist*float(furthest - fadeFrom);\n\n            const float overSample   = 4.0;\n            const float ringDistance = 0.075*overSample/4.0;\n            const float noOfRings    = 20.0*4.0/overSample;\n            const float glowFactor   = 0.05;\n\n            // License: Unknown, author: Unknown, found: don't remember\n            vec4 alphaBlend(vec4 back, vec4 front) {\n              float w = front.w + back.w*(1.0-front.w);\n              vec3 xyz = (front.xyz*front.w + back.xyz*back.w*(1.0-front.w))/w;\n              return w > 0.0 ? vec4(xyz, w) : vec4(0.0);\n            }\n\n            // License: Unknown, author: Unknown, found: don't remember\n            vec3 alphaBlend(vec3 back, vec4 front) {\n              return mix(back, front.xyz, front.w);\n            }\n\n            // License: Unknown, author: Unknown, found: don't remember\n            float tanh_approx(float x) {\n              float x2 = x*x;\n              return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);\n            }\n\n            // License: Unknown, author: Unknown, found: don't remember\n            float hash(float co) {\n              return fract(sin(co*12.9898) * 13758.5453);\n            }\n\n            vec3 offset(float z) {\n              float a = z;\n              vec2 p = -0.15*(vec2(cos(a), sin(a*sqrt(2.0))) + vec2(cos(a*sqrt(0.75)), sin(a*sqrt(0.5))));\n              return vec3(p, z);\n            }\n\n            vec3 doffset(float z) {\n              float eps = 0.05;\n              return 0.5*(offset(z + eps) - offset(z - eps))/(2.0*eps);\n            }\n\n            vec3 ddoffset(float z) {\n              float eps = 0.05;\n              return 0.5*(doffset(z + eps) - doffset(z - eps))/(2.0*eps);\n            }\n\n            vec3 skyColor(vec3 ro, vec3 rd) {\n              return vec3(0.0);\n            }\n\n            // License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/\n            float mod1(inout float p, float size) {\n              float halfsize = size*0.5;\n              float c = floor((p + halfsize)/size);\n              p = mod(p + halfsize, size) - halfsize;\n              return c;\n            }\n\n            // License: MIT, author: Pascal Gilcher, found: https://www.shadertoy.com/view/flSXRV\n            float atan_approx(float y, float x) {\n              float cosatan2 = x / (abs(x) + abs(y));\n              float t = PI_2 - cosatan2 * PI_2;\n              return y < 0.0 ? -t : t;\n            }\n\n            // License: CC0, author: M\u00e5rten R\u00e5nge, found: https://github.com/mrange/glsl-snippets\n            vec2 toPolar(vec2 p) {\n              return vec2(length(p), atan_approx(p.y, p.x));\n            }\n\n            vec3 glow(vec2 pp, float h) {\n              float hh = fract(h*8677.0);\n              float b = TAU*h+0.5*TIME*(hh > 0.5 ? 1.0 : -1.0);\n              float a = pp.y+b;\n              float d = max(abs(pp.x)-0.001, 0.00125);\n              return \n                ( smoothstep(0.667*ringDistance, 0.2*ringDistance, d)\n                  * smoothstep(0.1, 1.0, cos(a))\n                  * glowFactor\n                  * ringDistance\n                  / d\n                )\n                * (cos(a+b+vec3(0,1,2))+vec3(1.0))\n                ;\n            }\n\n            vec3 glowRings(vec2 p, float hh) {\n              vec2 pp = toPolar(p);\n\n              vec3 col = vec3(0.0);\n              float h = 1.0;\n              const float nr = 1.0/overSample;\n\n              for (float i = 0.0; i < overSample; ++i) {\n                vec2 ipp = pp;\n                ipp.x -= ringDistance*(nr*i);\n                float rn = mod1(ipp.x, ringDistance); \n                h = hash(rn+123.0*i);\n                col += glow(ipp, h)*step(rn, noOfRings);\n              }\n              \n              col += (0.01*vec3(1.0, 0.25, 0.0))/length(p);\n\n              return col;\n            }\n\n            vec4 plane(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {\n              float h = hash(n+123.4);\n\n              vec3 hn;\n              vec2 p = (pp-off*vec3(1.0, 1.0, 0.0)).xy;\n              float l = length(p);\n              float fade = smoothstep(0.1, 0.15, l);\n              if (fade < 0.1) return vec4(0.0);\n              vec4 col = vec4(0.0);\n              \n              col.xyz = glowRings(p*mix(0.5, 4.0, h), h);\n              float i = max(max(col.x, col.y), col.z);\n\n              col.w = (tanh_approx(0.5+max((i), 0.0))*fade);\n              return col;\n            }\n\n            vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {\n              float lp = length(p);\n              vec2 np = p + 1.0/RESOLUTION.xy;\n              const float rdd_per   = 10.0;\n              float rdd =  (1.75+0.75*pow(lp,1.5)*tanh_approx(lp+0.9*PCOS(rdd_per*p.x)*PCOS(rdd_per*p.y)));\n              \n              vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);\n              vec3 nrd = normalize(np.x*uu + np.y*vv + rdd*ww);\n\n              float nz = floor(ro.z / planeDist);\n\n              vec3 skyCol = skyColor(ro, rd);\n\n              vec4 acol = vec4(0.0);\n              const float cutOff = 0.95;\n              bool cutOut = false;\n\n              float maxpd = 0.0;\n\n              for (int i = 1; i <= furthest; ++i) {\n                float pz = planeDist*nz + planeDist*float(i);\n\n                float pd = (pz - ro.z)/rd.z;\n\n                if (pd > 0.0 && acol.w < cutOff) {\n                  vec3 pp = ro + rd*pd;\n                  maxpd = pd;\n                  vec3 npp = ro + nrd*pd;\n\n                  float aa = 3.0*length(pp - npp);\n\n                  vec3 off = offset(pp.z);\n\n                  vec4 pcol = plane(ro, rd, pp, off, aa, nz+float(i));\n\n                  float nz_dist = pp.z-ro.z;\n                  float fadeIn = smoothstep(planeDist*float(furthest), planeDist*float(fadeFrom), nz_dist);\n                  float fadeOut = smoothstep(0.0, planeDist*0.1, nz_dist);\n                  pcol.w *= fadeOut*fadeIn;\n                  pcol = clamp(pcol, 0.0, 1.0);\n\n                  acol = alphaBlend(pcol, acol);\n                } else {\n                  cutOut = true;\n                  acol.w = acol.w > cutOff ? 1.0 : acol.w;\n                  break;\n                }\n\n              }\n\n              vec3 col = alphaBlend(skyCol, acol);\n              return col;\n            }\n\n            vec3 effect(vec2 p, vec2 q) {\n              float tm  = planeDist*TIME*BPM/60.0;\n              vec3 ro   = offset(tm);\n              vec3 dro  = doffset(tm);\n              vec3 ddro = ddoffset(tm);\n\n              vec3 ww = normalize(dro);\n              vec3 uu = normalize(cross(normalize(vec3(0.0,1.0,0.0)+ddro), ww));\n              vec3 vv = cross(ww, uu);\n\n              vec3 col = color(ww, uu, vv, ro, p);\n              \n              col -= 0.075*vec3(2.0, 3.0, 1.0);\n              col *= sqrt(2.0);\n              col = clamp(col, 0.0, 1.0);\n              col = sqrt(col);\n              return col;\n            }\n\n            void main() {\n              vec2 fragCoord = gl_FragCoord.xy;\n              vec2 q = fragCoord/RESOLUTION.xy;\n              vec2 p = -1. + 2. * q;\n              p.x *= RESOLUTION.x/RESOLUTION.y;\n\n              vec3 col = effect(p, q);\n              \n              fragColor = vec4(col, 1.0);\n            }\n        `;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compile error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program link error:', gl.getProgramInfoLog(program));\n        }\n\n        const positionAttributeLocation = gl.getAttribLocation(program, \"position\");\n        const resolutionUniformLocation = gl.getUniformLocation(program, \"iResolution\");\n        const timeUniformLocation = gl.getUniformLocation(program, \"iTime\");\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const vao = gl.createVertexArray();\n        gl.bindVertexArray(vao);\n        gl.enableVertexAttribArray(positionAttributeLocation);\n        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);\n\n        function resize() {\n            canvas.width = window.innerWidth;\n            canvas.height = window.innerHeight;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n\n        window.addEventListener('resize', resize);\n        resize();\n\n        function render(time) {\n            time *= 0.001; // Convert to seconds\n\n            gl.useProgram(program);\n            gl.bindVertexArray(vao);\n\n            gl.uniform3f(resolutionUniformLocation, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(timeUniformLocation, time);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_simplicity_space",
    "path": "desktop-shaders/SPACE 2  add.html",
    "title": "Simplicity Galaxy Nebula",
    "files": {
      "SPACE 2  add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Simplicity Galaxy Viewer</title>\n  <style>\n    html, body {\n      margin: 0;\n      padding: 0;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n      background-color: #000;\n    }\n    canvas {\n      width: 100%;\n      height: 100%;\n      display: block;\n    }\n  </style>\n</head>\n<body>\n  <canvas id=\"glcanvas\"></canvas>\n\n  <script>\n    const canvas = document.getElementById('glcanvas');\n    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');\n\n    if (!gl) {\n      alert('WebGL is not supported in your browser.');\n    }\n\n    const vertexShaderSource = `\n      attribute vec2 a_position;\n      void main() {\n        gl_Position = vec4(a_position, 0.0, 1.0);\n      }\n    `;\n\n    const fragmentShaderSource = `\n      precision highp float;\n\n      uniform vec3 iResolution;\n      uniform float iTime;\n      uniform vec4 iMouse;\n\n      // By Jared Berghold 2022 (https://www.jaredberghold.com/)\n      // Based on the \"Simplicity Galaxy\" shader by CBS (https://www.shadertoy.com/view/MslGWN) \n      // The nebula effect is based on the kaliset fractal (https://softologyblog.wordpress.com/2011/05/04/kalisets-and-hybrid-ducks/)\n\n      const int MAX_ITER = 18;\n\n      float field(vec3 p, float s, int iter)\n      {\n        float accum = s / 4.0;\n        float prev = 0.0;\n        float tw = 0.0;\n        for (int i = 0; i < MAX_ITER; ++i) \n        {\n          if (i >= iter) // drop from the loop if the number of iterations has been completed\n          {\n            break;\n          }\n          float mag = dot(p, p);\n          p = abs(p) / mag + vec3(-0.5, -0.4, -1.487);\n          float w = exp(-float(i) / 5.0);\n          accum += w * exp(-9.025 * pow(abs(mag - prev), 2.2));\n          tw += w;\n          prev = mag;\n        }\n        return max(0.0, 5.2 * accum / tw - 0.65);\n      }\n\n      vec3 nrand3(vec2 co)\n      {\n        vec3 a = fract(cos(co.x*8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));\n        vec3 b = fract(sin(co.x*0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));\n        vec3 c = mix(a, b, 0.5);\n        return c;\n      }\n\n      vec4 starLayer(vec2 p, float time)\n      {\n        vec2 seed = 1.9 * p.xy;\n        seed = floor(seed * max(iResolution.x, 600.0) / 1.5);\n        vec3 rnd = nrand3(seed);\n        vec4 col = vec4(pow(rnd.y, 17.0));\n        float mul = 10.0 * rnd.x;\n        col.xyz *= sin(time * mul + mul) * 0.25 + 1.0;\n        return col;\n      }\n\n      void mainImage( out vec4 fragColor, in vec2 fragCoord )\n      {\n        float time = iTime / (iResolution.x / 1000.0);\n        \n        // first layer of the kaliset fractal\n        vec2 uv = 2.0 * fragCoord / iResolution.xy - 1.0;\n        vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);\n        vec3 p = vec3(uvs / 2.5, 0.0) + vec3(0.8, -1.3, 0.0);\n        p += 0.45 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));\n        \n        // adjust first layer position based on mouse movement\n        p.x += mix(-0.02, 0.02, (iMouse.x / iResolution.x));\n        p.y += mix(-0.02, 0.02, (iMouse.y / iResolution.y));\n        \n        float freqs[4];\n        freqs[0] = 0.45;\n        freqs[1] = 0.4;\n        freqs[2] = 0.15;\n        freqs[3] = 0.9;\n\n        float t = field(p, freqs[2], 13);\n        float v = (1.0 - exp((abs(uv.x) - 1.0) * 6.0)) * (1.0 - exp((abs(uv.y) - 1.0) * 6.0));\n        \n        // second layer of the kaliset fractal\n        vec3 p2 = vec3(uvs / (4.0 + sin(time * 0.11) * 0.2 + 0.2 + sin(time * 0.15) * 0.3 + 0.4), 4.0) + vec3(2.0, -1.3, -1.0);\n        p2 += 0.16 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));\n        \n        // adjust second layer position based on mouse movement\n        p2.x += mix(-0.01, 0.01, (iMouse.x / iResolution.x));\n        p2.y += mix(-0.01, 0.01, (iMouse.y / iResolution.y));\n        float t2 = field(p2, freqs[3], 18);\n        vec4 c2 = mix(0.5, 0.2, v) * vec4(5.5 * t2 * t2 * t2, 2.1 * t2 * t2, 2.2 * t2 * freqs[0], t2);\n        \n        // add stars (source: https://glslsandbox.com/e#6904.0)\n        vec4 starColour = vec4(0.0);\n        starColour += starLayer(p.xy, time); // add first layer of stars\n        starColour += starLayer(p2.xy, time); // add second layer of stars\n\n        const float brightness = 1.0;\n        vec4 colour = mix(freqs[3] - 0.3, 1.0, v) * vec4(1.5 * freqs[2] * t * t * t, 1.2 * freqs[1] * t * t, freqs[3] * t, 1.0) + c2 + starColour;\n        fragColor = vec4(brightness * colour.xyz, 1.0);\n      }\n\n      void main() {\n        mainImage(gl_FragColor, gl_FragCoord.xy);\n      }\n    `;\n\n    function createShader(gl, type, source) {\n      const shader = gl.createShader(type);\n      gl.shaderSource(shader, source);\n      gl.compileShader(shader);\n      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n        console.error(gl.getShaderInfoLog(shader));\n        gl.deleteShader(shader);\n        return null;\n      }\n      return shader;\n    }\n\n    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);\n    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);\n\n    const program = gl.createProgram();\n    gl.attachShader(program, vertexShader);\n    gl.attachShader(program, fragmentShader);\n    gl.linkProgram(program);\n\n    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n      console.error(gl.getProgramInfoLog(program));\n    }\n\n    const positionBuffer = gl.createBuffer();\n    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n      -1, -1,\n       1, -1,\n      -1,  1,\n      -1,  1,\n       1, -1,\n       1,  1,\n    ]), gl.STATIC_DRAW);\n\n    const positionLocation = gl.getAttribLocation(program, 'a_position');\n    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');\n    const timeLocation = gl.getUniformLocation(program, 'iTime');\n    const mouseLocation = gl.getUniformLocation(program, 'iMouse');\n\n    let mouseX = 0;\n    let mouseY = 0;\n\n    window.addEventListener('mousemove', (e) => {\n      mouseX = e.clientX;\n      mouseY = window.innerHeight - e.clientY; // Invert Y to match GLSL coordinates\n    });\n\n    function resizeCanvasToDisplaySize(canvas) {\n      const displayWidth  = window.innerWidth;\n      const displayHeight = window.innerHeight;\n\n      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {\n        canvas.width  = displayWidth;\n        canvas.height = displayHeight;\n        gl.viewport(0, 0, canvas.width, canvas.height);\n      }\n    }\n\n    function render(time) {\n      resizeCanvasToDisplaySize(gl.canvas);\n\n      gl.useProgram(program);\n\n      gl.enableVertexAttribArray(positionLocation);\n      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n      gl.uniform3f(resolutionLocation, gl.canvas.width, gl.canvas.height, 1.0);\n      gl.uniform1f(timeLocation, time * 0.001);\n      gl.uniform4f(mouseLocation, mouseX, mouseY, 0.0, 0.0);\n\n      gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n      requestAnimationFrame(render);\n    }\n\n    // Set initial mouse position to center\n    mouseX = window.innerWidth / 2;\n    mouseY = window.innerHeight / 2;\n\n    requestAnimationFrame(render);\n  </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_ocean_sunset",
    "path": "desktop-shaders/SUN------ add.html",
    "title": "Sunset Over Ocean",
    "files": {
      "SUN------ add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Sunset Over the Ocean Shader</title>\n    <style>\n        html, body {\n            margin: 0;\n            padding: 0;\n            width: 100%;\n            height: 100%;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const vsSource = `#version 300 es\n        in vec2 position;\n        void main() {\n            gl_Position = vec4(position, 0.0, 1.0);\n        }`;\n\n        const fsSource = `#version 300 es\n        precision highp float;\n\n        uniform vec3 iResolution;\n        uniform float iTime;\n        out vec4 fragColor;\n\n        // Sunset over the ocean.\n        // Minimalistic three color 2D shader\n        // inspired by this wonderful GIF: https://i.gifer.com/4Cb2.gif\n        //\n        // Features automatic anti aliasing by using smooth gradients\n        // removing the need for multi sampling.\n        //\n        // Revision 1:\n        //  - Add qnoise as approximation to value noise\n        //  - Inline remap() macro\n        //  - Beware of the Shark! (idea by FabriceNeyret2)\n        //\n        // Copyright (c) srvstr 2025\n        // Licensed under MIT\n        //\n\n        /* Simple cosine based approximation of perlin noise.\n         * Gives a more organic appearance.\n         */\n        float cnoise(in vec2 uv)\n        {\n            // Rotation matrix with values corresponding to sin(1.7) and cos(1.7).\n            const mat2 r = mat2(-0.1288, -0.9917, 0.9917, -0.1288);\n\n            vec2 s0 = cos(uv);\n            vec2 s1 = cos(uv * 2.5 * r);\n            vec2 s2 = cos(uv * 4.0 * r * r);\n\n            vec2 s = s0 * s1 * s2;\n\n            return (s.x + s.y) * 0.25 + 0.5;\n        }\n\n        #define S(x) (smoothstep(0.0, 1.0, (x)))\n\n        /* BW Mask of shark's fin.\n         */\n        float fin(in vec2 uv)\n        {\n            uv.x += S(S(S(abs(1.0 - 2.0 * fract(iTime * 0.02))))) - 0.5;\n            \n            uv *= vec2(sign(abs(1.0 - 2.0 * fract(iTime * 0.02 + 0.25)) - 0.5), 1) * 3.5;\n\n            float d = smoothstep(1.5/iResolution.y, 0.0,\n                                 uv.y\n                                 + 2.0 * uv.x * uv.x\n                                 + max(0.0, -(uv.y + 0.3) * (uv.y + 0.3) + uv.x * 3.0) * 5.0);\n\n            return 1.0 - d * smoothstep(-0.4, -0.4+3.0/iResolution.y,\n                                        uv.y + sin(iTime * 4.0 - uv.x * 16.0) / 100.0);\n        }\n\n        void mainImage(out vec4 fragColor, in vec2 fragCoord)\n        {\n            vec2 uv = (fragCoord - 0.5 * iResolution.xy)\n                        / iResolution.y;\n\n            // Bias for smoothstep function to simulate anti aliasing\n            // with gradients.\n            float dy = (smoothstep(0.0, -1.0, uv.y) * 40.0 + 1.5)\n                        / iResolution.y;\n\n            // Wave displacement factors.\n            // XY: scale the UV coordinates for the noise.\n            // Z: scales the noises strength.\n            vec3[] disp = vec3[](\n                vec3(vec2( 0.5, 20.0), 8.0),\n                vec3(vec2( 2.5, 60.0), 4.0),\n                vec3(vec2( 5.0, 80.0), 2.0),\n                vec3(vec2(10.0, 20.0), 2.0));\n\n            float avg = 0.0;\n            // Compute average of noise displacements\n            for (int i = 0; i < disp.length(); i++)\n            {\n                avg += cnoise(uv * disp[i].xy + iTime) * disp[i].z - disp[i].z * 0.5;\n            }\n            avg /= float(disp.length());\n\n            // Displace vertically.\n            vec2 st = vec2(uv.x,\n                           uv.y + clamp(avg * smoothstep(0.1, -1.0, uv.y), -0.1, 0.1));\n\n            // Compose output gradients.\n            fragColor.rgb = mix(vec3(0.85, 0.55, 0),\n                                vec3(0.90, 0.40, 0),\n                                sqrt(abs(st.y * st.y * st.y)) * 28.0) * fin(uv)\n                                /* Mask sun */\n                                * smoothstep(0.25 + dy, 0.25, length(st))\n                                /* Vingette + Background tint */\n                                + smoothstep(2.0, 0.5, length(uv)) * 0.1;\n        }\n\n        void main() {\n            mainImage(fragColor, gl_FragCoord.xy);\n            fragColor.a = 1.0;\n        }`;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compile error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        function init() {\n            const canvas = document.getElementById('glcanvas');\n            const gl = canvas.getContext('webgl2');\n\n            if (!gl) {\n                alert('WebGL 2 not supported by your browser.');\n                return;\n            }\n\n            const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n            const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n            const program = gl.createProgram();\n            gl.attachShader(program, vertexShader);\n            gl.attachShader(program, fragmentShader);\n            gl.linkProgram(program);\n\n            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n                console.error('Program link error:', gl.getProgramInfoLog(program));\n                return;\n            }\n\n            const positionAttributeLocation = gl.getAttribLocation(program, 'position');\n            const resolutionUniformLocation = gl.getUniformLocation(program, 'iResolution');\n            const timeUniformLocation = gl.getUniformLocation(program, 'iTime');\n\n            const positionBuffer = gl.createBuffer();\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n                -1, -1,\n                 1, -1,\n                -1,  1,\n                -1,  1,\n                 1, -1,\n                 1,  1,\n            ]), gl.STATIC_DRAW);\n\n            const vao = gl.createVertexArray();\n            gl.bindVertexArray(vao);\n            gl.enableVertexAttribArray(positionAttributeLocation);\n            gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);\n\n            function resizeCanvasToDisplaySize() {\n                const width = window.innerWidth * window.devicePixelRatio;\n                const height = window.innerHeight * window.devicePixelRatio;\n\n                if (canvas.width !== width || canvas.height !== height) {\n                    canvas.width = width;\n                    canvas.height = height;\n                    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);\n                }\n            }\n\n            function render(time) {\n                resizeCanvasToDisplaySize();\n\n                gl.useProgram(program);\n                gl.bindVertexArray(vao);\n\n                gl.uniform3f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height, 1.0);\n                gl.uniform1f(timeUniformLocation, time * 0.001);\n\n                gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n                requestAnimationFrame(render);\n            }\n\n            requestAnimationFrame(render);\n        }\n\n        window.onload = init;\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_toon_beach",
    "path": "desktop-shaders/TOON BEACH (2) aaddd.html",
    "title": "Toon Beach & Waves",
    "files": {
      "TOON BEACH (2) aaddd.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>GLSL Shader Viewer</title>\n  <style>\n    body, html {\n      margin: 0;\n      padding: 0;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n      background-color: #000;\n    }\n    #canvas-container {\n      width: 100vw;\n      height: 100vh;\n    }\n  </style>\n  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js\"></script>\n</head>\n<body>\n  <div id=\"canvas-container\"></div>\n\n  <script>\n    const container = document.getElementById('canvas-container');\n\n    // Scene & Camera setup\n    const scene = new THREE.Scene();\n    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);\n\n    // Renderer setup\n    const renderer = new THREE.WebGLRenderer({ antialias: true });\n    renderer.setSize(window.innerWidth, window.innerHeight);\n    renderer.setPixelRatio(window.devicePixelRatio);\n    container.appendChild(renderer.domElement);\n\n    // Uniforms matching Shadertoy input parameters\n    const uniforms = {\n      iTime: { value: 0 },\n      iResolution: { value: new THREE.Vector3(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio, 1) }\n    };\n\n    // GLSL Shader Code\n    const fragmentShader = `\n      uniform vec3 iResolution;\n      uniform float iTime;\n\n      #define PI 3.14159265359\n\n      float plotFoam(vec2 st, float pct){\n        return step(pct+0.06, st.y) - step(pct+0.08+abs(sin(iTime*0.25)*0.3), st.y);\n      }\n\n      float plotSand(vec2 st, float pct){\n        return step(pct+0.08, st.y);\n      }\n\n      float plotSea(vec2 st, float pct){\n        return step(pct-0.7, st.y) - step(pct+0.06, st.y);\n      }\n\n      float plotDeepSea(vec2 st, float pct){\n        return 1.0 - step(pct-0.7, st.y);\n      }\n\n      void mainImage( out vec4 fragColor, in vec2 fragCoord )\n      {\n        vec2 st = fragCoord.xy / vec2(iResolution.x,iResolution.y);\n        float y = sin(iTime* 0.5) * 0.4 + sin(PI * 8.0 * st.x) * 0.02 + st.x - 0.2;\n\n        vec3 color = vec3(y);\n\n        float foam = plotFoam(st, y);\n        float sand = plotSand(st, y);\n        float sea = plotSea(st, y);\n        float deepSea = plotDeepSea(st, y);\n        color = sea*vec3(0.0, 0.8, 1.0) + foam*vec3(1.0) + sand*vec3(1.0,0.8,0.2) + deepSea*vec3(0.2,0.3,0.8);\n\n        fragColor = vec4(color,1.0);\n      }\n\n      void main() {\n        mainImage(gl_FragColor, gl_FragCoord.xy);\n      }\n    `;\n\n    const vertexShader = `\n      void main() {\n        gl_Position = vec4(position, 1.0);\n      }\n    `;\n\n    // Fullscreen Plane Mesh\n    const material = new THREE.ShaderMaterial({\n      vertexShader: vertexShader,\n      fragmentShader: fragmentShader,\n      uniforms: uniforms\n    });\n\n    const geometry = new THREE.PlaneGeometry(2, 2);\n    const mesh = new THREE.Mesh(geometry, material);\n    scene.add(mesh);\n\n    // Window Resize Handling\n    window.addEventListener('resize', () => {\n      const width = window.innerWidth;\n      const height = window.innerHeight;\n      renderer.setSize(width, height);\n      uniforms.iResolution.value.set(width * window.devicePixelRatio, height * window.devicePixelRatio, 1);\n    });\n\n    // Render Loop\n    function animate(time) {\n      requestAnimationFrame(animate);\n      uniforms.iTime.value = time * 0.001; // Convert milliseconds to seconds\n      renderer.render(scene, camera);\n    }\n\n    animate(0);\n  </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_toon_clouds",
    "path": "desktop-shaders/TOON CLOUDS addd.html",
    "title": "Procedural Toon Clouds",
    "files": {
      "TOON CLOUDS addd.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Procedural Layers Shader</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100vw;\n            height: 100vh;\n            display: block;\n            cursor: grab;\n        }\n        canvas:active {\n            cursor: grabbing;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl2');\n\n        if (!gl) {\n            alert('WebGL 2 not supported by your browser.');\n        }\n\n        const vsSource = `#version 300 es\n        in vec2 a_position;\n        void main() {\n            gl_Position = vec4(a_position, 0.0, 1.0);\n        }`;\n\n        const fsSource = `#version 300 es\n        precision highp float;\n\n        out vec4 fragColor;\n\n        uniform vec3 iResolution;\n        uniform float iTime;\n        uniform vec2 iMouse;\n        uniform vec2 iCamAngle;\n\n        // Procedural noise replacement for texture(iChannel0, ...)\n        float hash(vec2 p) {\n            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);\n        }\n\n        float noise(vec2 x){\n            vec2 f = fract(x);\n            vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);\n            \n            vec2 p = floor(x);\n            float a = hash(p + vec2(0.0, 0.0));\n            float b = hash(p + vec2(1.0, 0.0));\n            float c = hash(p + vec2(0.0, 1.0));\n            float d = hash(p + vec2(1.0, 1.0));\n            \n            return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;\n        }\n\n        #define OCTAVES 8\n        float fbm(vec2 x){\n            float a = 0.0;\n            float b = 1.0;\n            float t = 0.0;\n            for(int i = 0; i < OCTAVES; i++){\n                float n = noise(x);\n                a += b*n;\n                t += b;\n                b *= 0.7;\n                x *= 1.7; \n            }\n            return a/t;\n        }\n\n        #define layer(s, v) if (rand < s) return vec4(v, 1.);\n\n        vec4 layers(vec2 uv, float t){\n            float rand;\n            float speed;\n            float offset;\n            float size;\n            vec2 uv2;\n\n            size = 2.;\n            offset = 0.;\n            speed = 1.;\n\n            uv2 = uv + vec2(0., t*speed + offset);\n            rand = fbm(uv2 * size);\n\n            size = 6.;\n            offset = 0.;\n            speed = .5;\n\n            uv2 = uv + vec2(0., t*speed + offset);\n            rand = fbm(uv2 * size);\n\n            layer(0.46, vec3(0.92, 0.85, 0.82));\n            layer(0.50, vec3(1.0, 0.94, 0.91));\n            \n            return vec4(0.2, 0.3, 0.5, 1.);\n        }\n\n        void mainImage( out vec4 fragColor, in vec2 fragCoord )\n        {\n            vec2 uv = fragCoord / iResolution.xy;\n            \n            // Apply camera orientation offsets\n            uv += iCamAngle * 0.5;\n\n            float t = iTime * .1;\n            fragColor = layers(uv, t);\n        }\n\n        void main() {\n            mainImage(fragColor, gl_FragCoord.xy);\n        }\n        `;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compilation error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program link error:', gl.getProgramInfoLog(program));\n        }\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const positionLocation = gl.getAttribLocation(program, 'a_position');\n        const resolutionLocation = gl.getUniformLocation(program, 'iResolution');\n        const timeLocation = gl.getUniformLocation(program, 'iTime');\n        const mouseLocation = gl.getUniformLocation(program, 'iMouse');\n        const camAngleLocation = gl.getUniformLocation(program, 'iCamAngle');\n\n        let isMouseDown = false;\n        let lastMousePos = { x: 0, y: 0 };\n        let camAngle = { x: 0, y: 0 };\n        let mousePos = { x: 0, y: 0 };\n\n        canvas.addEventListener('mousedown', (e) => {\n            isMouseDown = true;\n            lastMousePos = { x: e.clientX, y: e.clientY };\n        });\n\n        window.addEventListener('mouseup', () => {\n            isMouseDown = false;\n        });\n\n        window.addEventListener('mousemove', (e) => {\n            mousePos.x = e.clientX;\n            mousePos.y = canvas.height - e.clientY;\n\n            if (isMouseDown) {\n                const deltaX = e.clientX - lastMousePos.x;\n                const deltaY = e.clientY - lastMousePos.y;\n\n                camAngle.x -= deltaX * 0.002;\n                camAngle.y += deltaY * 0.002;\n\n                lastMousePos = { x: e.clientX, y: e.clientY };\n            }\n        });\n\n        function resize() {\n            canvas.width = window.innerWidth;\n            canvas.height = window.innerHeight;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n        window.addEventListener('resize', resize);\n        resize();\n\n        function render(time) {\n            time *= 0.001;\n\n            gl.useProgram(program);\n\n            gl.enableVertexAttribArray(positionLocation);\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(timeLocation, time);\n            gl.uniform2f(mouseLocation, mousePos.x, mousePos.y);\n            gl.uniform2f(camAngleLocation, camAngle.x, camAngle.y);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_toon_water_voronoi",
    "path": "desktop-shaders/TOON WATER 2 GOOD addd.html",
    "title": "Toon Voronoi Water",
    "files": {
      "TOON WATER 2 GOOD addd.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Voronoi Shader with Free Camera Control</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n            overflow: hidden;\n        }\n        body, html {\n            width: 100%;\n            height: 100%;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n        #ui {\n            position: absolute;\n            top: 10px;\n            left: 10px;\n            color: rgba(255, 255, 255, 0.8);\n            font-family: monospace;\n            font-size: 12px;\n            pointer-events: none;\n            background: rgba(0, 0, 0, 0.5);\n            padding: 8px 12px;\n            border-radius: 4px;\n        }\n    </style>\n</head>\n<body>\n    <div id=\"ui\">\n        Pan: Left Click + Drag<br>\n        Zoom: Mouse Wheel<br>\n        Reset: Double Click\n    </div>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const vsSource = `\n            attribute vec2 position;\n            void main() {\n                gl_Position = vec4(position, 0.0, 1.0);\n            }\n        `;\n\n        const fsSource = `\n            precision highp float;\n            uniform vec3 iResolution;\n            uniform float iTime;\n            uniform vec2 iOffset;\n            uniform float iZoom;\n\n            // This shader was possible thanks to @BitterZephyr - for physical & mental support XD\n            float hash1( float n ) { return fract(sin(n)*43758.5453); }\n            vec2 hash2( vec2 p ) { p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) ); return fract(sin(p)*43758.5453); }\n\n            // The parameter w controls the smoothness\n            float voronoi( in vec2 x, float w, float offset)\n            {\n                vec2 n = floor( x );\n                vec2 f = fract( x );\n\n                float m = 8.0;\n                for( int j=-2; j<=2; j++ )\n                for( int i=-2; i<=2; i++ )\n                {\n                    vec2 g = vec2( float(i),float(j) );\n                    vec2 o = hash2( n + g );\n                    \n                    // animate\n                    o = offset + 0.3*sin(iTime + 6.2831*o + x);\n                    \n                    // distance to cell\t\t\n                    float d = length(g - f + o);\n                    \n                    // do the smooth min for colors and distances\t\t\n                    float h = smoothstep( -1.0, 1.0, (m-d)/w );\n                    m = mix( m, d, h ) - h*(1.0-h)*w/(1.0+3.0*w); // distance\n                }\n                \n                return m;\n            }\n\n            void mainImage( out vec4 fragColor, in vec2 fragCoord )\n            {\n                vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y; // normalize canvas\n                \n                // Free camera controls transform\n                uv = (uv - iOffset) / iZoom;\n\n                vec4 color = vec4(0.0);\n               \n                uv = uv * 2.0;\n                // Moves the canvas diagonally\n                uv.x += iTime * .5;\n                uv.y += iTime * .25;\n                \n                //My color pallete\n                vec4 a = vec4(0.114,0.635,0.847,1.0);\n                vec4 b = vec4(1.000,1.000,1.000,1.0);\n                //vec4 c = vec4(0.600,0.522,0.000,1.0);\n                vec4 c = a * 0.8; // darkens the a color\n                \n                //My first Top Voronoi Noise\n                float vNoise = voronoi(uv, 0.001, 0.5);\n                float sNoise = voronoi(uv, 0.4, 0.5);\n                float fVoronoi = smoothstep(0.0, 0.01, vNoise-sNoise);\n                \n                // My Second Offset Voronoi Noise\n                float vNoise2 = voronoi(uv, 0.001, 0.3);\n                float sNoise2 = voronoi(uv, 0.4, 0.3);\n                float offsetVoronoi = smoothstep(0.0, 0.01, vNoise2-sNoise2);\n                \n                // BG Stripes\n                float pi = 3.14159265359;\n                float wave = sin(pi*(uv.x+uv.y));\n                wave = (wave+1.)/2.; // to get the output in the range of 0 to 1\n                \n                vec4 bgColor = mix(a,c,wave);\n                vec4 bgColor2 = mix(a, c, offsetVoronoi + wave);\n                //vec4 bgColor = mix(a,c,offsetVoronoi); // assigns to the offsetVoronoi noise the 2 colors\n                \n                // Final Voronoi Noise\n                vec4 finalVoronoi = vec4(mix(bgColor2, b, fVoronoi));\n                \n                fragColor = vec4(finalVoronoi);\n            }\n\n            void main() {\n                mainImage(gl_FragColor, gl_FragCoord.xy);\n            }\n        `;\n\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');\n\n        if (!gl) {\n            alert('WebGL not supported');\n        }\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compilation error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program linking error:', gl.getProgramInfoLog(program));\n        }\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1.0, -1.0,\n             1.0, -1.0,\n            -1.0,  1.0,\n            -1.0,  1.0,\n             1.0, -1.0,\n             1.0,  1.0,\n        ]), gl.STATIC_DRAW);\n\n        const positionLocation = gl.getAttribLocation(program, 'position');\n        const resolutionLocation = gl.getUniformLocation(program, 'iResolution');\n        const timeLocation = gl.getUniformLocation(program, 'iTime');\n        const offsetLocation = gl.getUniformLocation(program, 'iOffset');\n        const zoomLocation = gl.getUniformLocation(program, 'iZoom');\n\n        // Camera state\n        let offset = [0.0, 0.0];\n        let zoom = 1.0;\n        let isDragging = false;\n        let previousMousePosition = { x: 0, y: 0 };\n\n        function resizeCanvasToDisplaySize() {\n            const width = window.innerWidth;\n            const height = window.innerHeight;\n            if (canvas.width !== width || canvas.height !== height) {\n                canvas.width = width;\n                canvas.height = height;\n                gl.viewport(0, 0, width, height);\n            }\n        }\n\n        // Camera interactions\n        window.addEventListener('mousedown', (e) => {\n            if (e.button === 0) { // Left click\n                isDragging = true;\n                previousMousePosition = { x: e.clientX, y: e.clientY };\n            }\n        });\n\n        window.addEventListener('mousemove', (e) => {\n            if (isDragging) {\n                const deltaX = e.clientX - previousMousePosition.x;\n                const deltaY = e.clientY - previousMousePosition.y;\n\n                // Normalize delta relative to canvas aspect ratio and zoom level\n                offset[0] += (deltaX * 2.0 / canvas.height);\n                offset[1] -= (deltaY * 2.0 / canvas.height);\n\n                previousMousePosition = { x: e.clientX, y: e.clientY };\n            }\n        });\n\n        window.addEventListener('mouseup', () => { isDragging = false; });\n        window.addEventListener('mouseleave', () => { isDragging = false; });\n\n        window.addEventListener('wheel', (e) => {\n            e.preventDefault();\n            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;\n            zoom *= zoomFactor;\n            zoom = Math.max(0.01, Math.min(zoom, 100.0)); // Clamp zoom range\n        }, { passive: false });\n\n        window.addEventListener('dblclick', () => {\n            offset = [0.0, 0.0];\n            zoom = 1.0;\n        });\n\n        function render(time) {\n            resizeCanvasToDisplaySize();\n\n            gl.useProgram(program);\n\n            gl.enableVertexAttribArray(positionLocation);\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform3f(resolutionLocation, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(timeLocation, time * 0.001);\n            gl.uniform2f(offsetLocation, offset[0], offset[1]);\n            gl.uniform1f(zoomLocation, zoom);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_toon_water_flow",
    "path": "desktop-shaders/TOON WATER 06-------add.html",
    "title": "Stylized Water Flow",
    "files": {
      "TOON WATER 06-------add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Shader Viewer</title>\n    <style>\n        body, html {\n            margin: 0;\n            padding: 0;\n            width: 100%;\n            height: 100%;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"canvas\"></canvas>\n\n    <script id=\"fragmentShader\" type=\"x-shader/x-fragment\">\n        precision highp float;\n        \n        uniform vec3 iResolution;\n        uniform float iTime;\n\n        // By Morgan McGuire @morgan3d, http://graphicscodex.com\n        // Reuse permitted under the BSD license.\n\n        // All noise functions are designed for values on integer scale.\n        // They are tuned to avoid visible periodicity for both positive and\n        // negative coordinates within a few orders of magnitude.\n\n        // For multiple octaves\n        #define NOISE fbm\n        #define NUM_NOISE_OCTAVES 2\n        #define SPEED 1.0\n        //#define SMOOTH 1\n\n\n        float hash(float n) { return fract(sin(n) * 1e4); }\n        float hash(vec2 p) { return  (sin(iTime*3.0*SPEED)*0.02) + fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }\n\n        float noise(float x) {\n            float i = floor(x);\n            float f = fract(x);\n            float u = f * f * (3.0 - 2.0 * f);\n            return mix(hash(i), hash(i + 1.0), u);\n        }\n\n\n        float noise(vec2 x) {\n            vec2 i = floor(x);\n            vec2 f = fract(x);\n\n            // Four corners in 2D of a tile\n            float a = hash(i);\n            float b = hash(i + vec2(1.0, 0.0));\n            float c = hash(i + vec2(0.0, 1.0));\n            float d = hash(i + vec2(1.0, 1.0));\n\n            vec2 u = f * f * (3.0 - 2.0 * f);\n            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;\n        }\n\n\n        float noise(vec3 x) {\n            const vec3 step = vec3(110, 241, 171);\n\n            vec3 i = floor(x);\n            vec3 f = fract(x);\n         \n            float n = dot(i, step);\n\n            vec3 u = f * f * (3.0 - 2.0 * f);\n            return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),\n                           mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),\n                       mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),\n                           mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);\n        }\n\n\n        float fbm(float x) {\n            float v = 0.0;\n            float a = 0.5;\n            float shift = float(100);\n            for (int i = 0; i < NUM_NOISE_OCTAVES; ++i) {\n                v += a * noise(x);\n                x = x * 2.0 + shift;\n                a *= 0.5;\n            }\n            return v;\n        }\n\n\n        float fbm(vec2 x) {\n            float v = 0.0;\n            float a = 0.5;\n            vec2 shift = vec2(100);\n            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));\n            for (int i = 0; i < NUM_NOISE_OCTAVES; ++i) {\n                v += a * noise(x);\n                x = rot * x * 2.0 + shift;\n                a *= 0.5;\n            }\n            return v;\n        }\n\n\n        float fbm(vec3 x) {\n            float v = 0.0;\n            float a = 0.5;\n            vec3 shift = vec3(100);\n            for (int i = 0; i < NUM_NOISE_OCTAVES; ++i) {\n                v += a * noise(x);\n                x = x * 2.0 + shift;\n                a *= 0.5;\n            }\n            return v;\n        }\n\n\n        void mainImage( out vec4 fragColor, in vec2 fragCoord ) {\n            vec2 coord = fragCoord.xy * 0.015 - vec2(iTime * 0.5, iResolution.y / 2.0);\n            float speed = 0.3*SPEED;\n            float limit = 0.1;\n            float border = 0.025;\n            float c = NOISE(coord - speed*iTime ) * NOISE(coord + speed*iTime );\n            vec3 color = vec3(step(limit-border,c), step(limit, c), 1);\n            if (color.x == 1.0 && color.y != 1.0 && color.x == 1.0) { color = vec3(1.0, 1.0, 1.0); }\n            else { color = vec3(0.06, 0.4, 1.0); }\n        #ifdef SMOOTH\n            c = smoothstep(limit - border, limit, c) - smoothstep(limit, limit + border, c);\n            fragColor = vec4(c * c * c, 0.25 + 0.75 * c * c, 0.5 + 0.5 * c, 1.0);\n        #else\n            fragColor.rgb = clamp(color, 0.0, 1.0);\n            fragColor.a = 1.0;\n        #endif\n        }\n\n        void main() {\n            mainImage(gl_FragColor, gl_FragCoord.xy);\n        }\n    </script>\n\n    <script>\n        const canvas = document.getElementById('canvas');\n        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');\n\n        if (!gl) {\n            alert('WebGL not supported');\n        }\n\n        const vsSource = `\n            attribute vec2 position;\n            void main() {\n                gl_Position = vec4(position, 0.0, 1.0);\n            }\n        `;\n\n        const fsSource = document.getElementById('fragmentShader').text;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compile error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program link error:', gl.getProgramInfoLog(program));\n        }\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const positionLocation = gl.getAttribLocation(program, 'position');\n        const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');\n        const iTimeLocation = gl.getUniformLocation(program, 'iTime');\n\n        function resize() {\n            canvas.width = window.innerWidth * window.devicePixelRatio;\n            canvas.height = window.innerHeight * window.devicePixelRatio;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n\n        window.addEventListener('resize', resize);\n        resize();\n\n        function render(time) {\n            time *= 0.001;\n\n            gl.useProgram(program);\n\n            gl.enableVertexAttribArray(positionLocation);\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform3f(iResolutionLocation, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(iTimeLocation, time);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  },
  {
    "name": "desktop-live_waterfall_toon",
    "path": "desktop-shaders/WATERFALL TOON 2 (2)add.html",
    "title": "Waterfall Toon Waves",
    "files": {
      "WATERFALL TOON 2 (2)add.html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Stylized Waves Shader with Free Camera Control</title>\n    <style>\n        html, body {\n            margin: 0;\n            padding: 0;\n            width: 100%;\n            height: 100%;\n            overflow: hidden;\n            background-color: #000;\n        }\n        canvas {\n            width: 100%;\n            height: 100%;\n            display: block;\n        }\n    </style>\n</head>\n<body>\n    <canvas id=\"glcanvas\"></canvas>\n\n    <script>\n        const canvas = document.getElementById('glcanvas');\n        const gl = canvas.getContext('webgl2');\n\n        if (!gl) {\n            alert('WebGL 2 not supported by your browser.');\n        }\n\n        const vsSource = `#version 300 es\n        in vec2 position;\n        void main() {\n            gl_Position = vec4(position, 0.0, 1.0);\n        }`;\n\n        const fsSource = `#version 300 es\n        precision highp float;\n\n        uniform vec3 iResolution;\n        uniform float iTime;\n        uniform vec4 iMouse;\n        uniform vec2 u_camOffset;\n        uniform float u_camZoom;\n\n        out vec4 fragColor;\n\n        #define T iTime\n\n        vec2 hash(vec2 p) {\n            p = vec2(dot(p, vec2(127.1, 311.7)),\n                     dot(p, vec2(269.5, 183.3)));\n            return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);\n        }\n\n        float noise(vec2 p) {\n            const float K1 = 0.366025404; // (sqrt(3)-1)/2\n            const float K2 = 0.211324865; // (3-sqrt(3))/6\n\n            vec2 i = floor(p + (p.x + p.y) * K1);\n            vec2 a = p - i + (i.x + i.y) * K2;\n            vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n            vec2 b = a - o + K2;\n            vec2 c = a - 1.0 + 2.0 * K2;\n\n            vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);\n\n            vec3 n = h * h * h * h * vec3(\n                dot(a, hash(i + 0.0)),\n                dot(b, hash(i + o)),\n                dot(c, hash(i + 1.0))\n            );\n\n            return dot(n, vec3(70.0));\n        }\n\n        float fbm(vec2 p) {\n            float a = .5;\n            float n = 0.;\n\n            for(float i = 0.; i < 4.; i++) {\n                n += a * noise(p);\n                p *= 2.;\n                a *= .5;\n            }\n            return n;\n        }\n\n        void mainImage(out vec4 O, in vec2 I) {\n            vec2 center = iResolution.xy * 0.5;\n            vec2 adjustedCoord = (I - center) * u_camZoom + center - u_camOffset;\n\n            vec2 R = iResolution.xy;\n            vec2 uv = adjustedCoord / R.y;\n\n            // Background\n            O.rgb = vec3(0.69, 0.8, 0.54);\n            O.a = 1.;\n            float n, d, s;\n\n            // Large ripples in background\n            n = noise(uv * vec2(12., 1.) + vec2(0, T * 1.5));\n            s = smoothstep(0.2, 0.1, abs(n));\n            O.rgb = mix(O.rgb, vec3(0.81, 0.93, 0.66), s);\n\n            // Bottom shadow\n            n = noise(uv * vec2(6., .5) + vec2(0, T));\n            float d1 = uv.y - 0.2 + n * 0.6;\n            s = smoothstep(0.2, 0.1, d1);\n            O.rgb = mix(O.rgb, vec3(0.557, 0.627, 0.475), s);\n\n            // Bottom shadow's shadow details\n            d1 = abs(uv.y - sin(7. * uv.x + T * 3.) / 20. - 0.2);\n            s = smoothstep(0.1, 0., d1);\n            n = noise(uv * vec2(40., 1.5) + vec2(T));\n            s *= n * smoothstep(0., 0.5, sin(uv.x * 4. - 0.8));\n            s = smoothstep(0.2, 0.25, s);\n            O.rgb = mix(O.rgb, vec3(0.455, 0.522, 0.341), s);\n\n            // Middle highlight\n            d = abs(uv.y - sin(30. * uv.x + T * 3.) / 20. - 0.5);\n            s = smoothstep(0.2, 0., d);\n            s *= n * smoothstep(0., 0.5, sin(uv.x * 6. - 2.));\n            s = smoothstep(0.1, 0.2, s);\n            O.rgb = mix(O.rgb, vec3(1, 1, 0.85), s);\n\n            // Top highlight\n            d1 = abs(uv.y - sin(20. * uv.x + T * 4.) / 40. - 0.8);\n            s = smoothstep(0.15, 0., d1);\n            s *= n * smoothstep(0., 0.1, sin(uv.x * 8.));\n            s = smoothstep(0.05, 0.2, s);\n            O.rgb = mix(O.rgb, vec3(1, 1, 0.95), s);\n\n            // Bottom wave layer\n            n = fbm(uv + T * 0.4);\n            d1 = uv.y - sin(uv.x * 5. + T * 5.) / 25. - n * 0.1;\n            s = smoothstep(0.1, 0., d1);\n            s = s + n * s;\n            s = clamp(s, 0., 1.);\n            float s1 = smoothstep(0.1, 0.21, s);\n            O.rgb = mix(O.rgb, vec3(0.87, 0.96, 0.76), s1);\n            float s2 = smoothstep(0.5, 0.51, s);\n            O.rgb = mix(O.rgb, vec3(0.76, 0.86, 0.67), s2);\n        }\n\n        void main() {\n            mainImage(fragColor, gl_FragCoord.xy);\n        }\n        `;\n\n        function createShader(gl, type, source) {\n            const shader = gl.createShader(type);\n            gl.shaderSource(shader, source);\n            gl.compileShader(shader);\n            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {\n                console.error('Shader compile error:', gl.getShaderInfoLog(shader));\n                gl.deleteShader(shader);\n                return null;\n            }\n            return shader;\n        }\n\n        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);\n        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);\n\n        const program = gl.createProgram();\n        gl.attachShader(program, vertexShader);\n        gl.attachShader(program, fragmentShader);\n        gl.linkProgram(program);\n\n        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {\n            console.error('Program link error:', gl.getProgramInfoLog(program));\n        }\n\n        const positionBuffer = gl.createBuffer();\n        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([\n            -1, -1,\n             1, -1,\n            -1,  1,\n            -1,  1,\n             1, -1,\n             1,  1,\n        ]), gl.STATIC_DRAW);\n\n        const positionLoc = gl.getAttribLocation(program, 'position');\n        const resolutionLoc = gl.getUniformLocation(program, 'iResolution');\n        const timeLoc = gl.getUniformLocation(program, 'iTime');\n        const mouseLoc = gl.getUniformLocation(program, 'iMouse');\n        const camOffsetLoc = gl.getUniformLocation(program, 'u_camOffset');\n        const camZoomLoc = gl.getUniformLocation(program, 'u_camZoom');\n\n        // Free Camera state\n        let camOffset = { x: 0, y: 0 };\n        let camZoom = 1.0;\n        let isDragging = false;\n        let lastMousePos = { x: 0, y: 0 };\n        let iMouse = [0, 0, 0, 0];\n\n        // Controls\n        window.addEventListener('mousedown', (e) => {\n            isDragging = true;\n            lastMousePos = { x: e.clientX, y: e.clientY };\n            iMouse[0] = e.clientX;\n            iMouse[1] = canvas.height - e.clientY;\n            iMouse[2] = iMouse[0];\n            iMouse[3] = iMouse[1];\n        });\n\n        window.addEventListener('mousemove', (e) => {\n            iMouse[0] = e.clientX;\n            iMouse[1] = canvas.height - e.clientY;\n\n            if (isDragging) {\n                const dx = e.clientX - lastMousePos.x;\n                const dy = -(e.clientY - lastMousePos.y);\n\n                camOffset.x += dx * camZoom;\n                camOffset.y += dy * camZoom;\n\n                lastMousePos = { x: e.clientX, y: e.clientY };\n            }\n        });\n\n        window.addEventListener('mouseup', () => {\n            isDragging = false;\n            iMouse[2] = 0;\n            iMouse[3] = 0;\n        });\n\n        window.addEventListener('wheel', (e) => {\n            const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;\n            camZoom *= zoomFactor;\n            camZoom = Math.max(0.05, Math.min(camZoom, 50.0));\n        }, { passive: true });\n\n        function resizeCanvas() {\n            canvas.width = window.innerWidth * window.devicePixelRatio;\n            canvas.height = window.innerHeight * window.devicePixelRatio;\n            gl.viewport(0, 0, canvas.width, canvas.height);\n        }\n        window.addEventListener('resize', resizeCanvas);\n        resizeCanvas();\n\n        function render(time) {\n            time *= 0.001;\n\n            gl.clearColor(0, 0, 0, 1);\n            gl.clear(gl.COLOR_BUFFER_BIT);\n\n            gl.useProgram(program);\n\n            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);\n            gl.enableVertexAttribArray(positionLoc);\n            gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);\n\n            gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1.0);\n            gl.uniform1f(timeLoc, time);\n            gl.uniform4fv(mouseLoc, iMouse);\n            gl.uniform2f(camOffsetLoc, camOffset.x, camOffset.y);\n            gl.uniform1f(camZoomLoc, camZoom);\n\n            gl.drawArrays(gl.TRIANGLES, 0, 6);\n\n            requestAnimationFrame(render);\n        }\n\n        requestAnimationFrame(render);\n    </script>\n</body>\n</html>"
    }
  }
];
