// Reze WebGPU WGSL Shaders

export const REZE_MATERIAL_PRESETS = [
  {
    id: 'reze_cyber_particle',
    name: 'Reze: Cyber WebGPU Particle Matrix',
    category: '? WebGPU & Cyber',
    type: 'shader',
    description: 'High-speed compute particle field visualization with glowing neon pulse lines.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#00f7ff');
      grad.addColorStop(0.3, '#0084ff');
      grad.addColorStop(0.7, '#1b004b');
      grad.addColorStop(1, '#050014');
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
  float fresnel = pow(1.0 - max(0.0, dot(V, N)), 2.0);
  float grid = step(0.92, fract(v_uv.x * 24.0 + u_time * 0.2)) + step(0.92, fract(v_uv.y * 24.0));
  vec3 col = mix(vec3(0.03, 0.01, 0.15), vec3(0.0, 0.95, 1.0), grid);
  col += vec3(0.9, 0.1, 0.9) * fresnel * 1.2;
  gl_FragColor = vec4(col, 1.0);
}`
  }
];
