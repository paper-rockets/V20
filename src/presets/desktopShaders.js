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
