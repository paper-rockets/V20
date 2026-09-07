// Grassworks TSL Shaders

export const GRASSWORKS_MATERIAL_PRESETS = [
  {
    id: 'grassworks_wind_wave',
    name: 'Grassworks: Procedural Wind Turbulence',
    category: '?? Wayfinder & Grassworks',
    type: 'shader',
    description: 'Dense field blade simulation with dual trigonometric wave propagation and tip oscillation.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#b8e994');
      grad.addColorStop(0.3, '#78e08f');
      grad.addColorStop(0.65, '#38ada9');
      grad.addColorStop(1, '#074241');
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
  float wind = sin(pos.x * 6.0 + u_time * 3.0) * cos(pos.z * 4.0 + u_time * 2.2) * 0.12;
  pos.x += wind * (pos.y + 1.0);
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
  float diff = max(0.0, dot(N, normalize(vec3(0.4, 0.9, 0.3))));
  vec3 baseGreen = mix(vec3(0.08, 0.32, 0.18), vec3(0.45, 0.88, 0.35), diff);
  float tipGlow = pow(1.0 - max(0.0, dot(V, N)), 2.5);
  baseGreen += vec3(0.8, 1.0, 0.4) * tipGlow * 0.5;
  gl_FragColor = vec4(baseGreen, 1.0);
}`
  }
];
