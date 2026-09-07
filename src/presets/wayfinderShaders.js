// Wayfinder Extracted & Interactive Shaders

export const WAYFINDER_MATERIAL_PRESETS = [
  {
    id: 'wayfinder_toon_forest',
    name: 'Wayfinder: Biome Toon Shading',
    category: '?? Wayfinder & Grassworks',
    type: 'shader',
    description: 'Generative multi-step cel shading with rim lighting, value noise dither, and ground bounce.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#a8e6cf');
      grad.addColorStop(0.3, '#3bba9c');
      grad.addColorStop(0.65, '#2e3047');
      grad.addColorStop(1, '#171926');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0.4, 2.2); ctx.stroke();
    },
    vertexShader: `precision mediump float;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;
void main() {
  v_uv = uv;
  v_normal = normalize(normalMatrix * normal);
  v_position = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;
void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(-v_position);
  vec3 L = normalize(vec3(0.5, 0.8, 0.6));
  float diff = dot(N, L) * 0.5 + 0.5;
  float rim = 1.0 - max(0.0, dot(V, N));
  rim = smoothstep(0.45, 0.75, rim);
  float stepDiff = smoothstep(0.3, 0.35, diff) * 0.4 + smoothstep(0.65, 0.7, diff) * 0.6;
  vec3 base = mix(vec3(0.18, 0.19, 0.28), vec3(0.23, 0.73, 0.61), stepDiff);
  base += vec3(0.66, 0.90, 0.81) * rim * 0.7;
  gl_FragColor = vec4(base, 1.0);
}`
  },
  {
    id: 'wayfinder_water_stream',
    name: 'Wayfinder: Procedural Water Stream',
    category: '?? Wayfinder & Grassworks',
    type: 'shader',
    description: 'Flowing river ripples with animated Voronoi water surface and Fresnel rim reflection.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.6, cy * 0.4, 5, cx, cy, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#64b5f6');
      grad.addColorStop(0.6, '#1976d2');
      grad.addColorStop(1, '#0d47a1');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    },
    vertexShader: `precision mediump float;
uniform float u_time;
varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;
void main() {
  v_uv = uv;
  vec3 pos = position;
  float wave = sin(pos.x * 5.0 + u_time * 2.0) * cos(pos.z * 5.0 + u_time * 1.5) * 0.08;
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
  vec3 N = normalize(v_normal);
  vec3 V = normalize(-v_position);
  float fresnel = pow(1.0 - max(0.0, dot(V, N)), 2.5);
  float wavePat = sin(v_uv.x * 20.0 + u_time * 2.0) * cos(v_uv.y * 20.0 + u_time * 1.8);
  vec3 deepWater = vec3(0.05, 0.28, 0.63);
  vec3 shallowWater = vec3(0.39, 0.71, 0.96);
  vec3 col = mix(deepWater, shallowWater, wavePat * 0.5 + 0.5);
  col += vec3(1.0) * fresnel * 0.6;
  gl_FragColor = vec4(col, 0.95);
}`
  }
];
