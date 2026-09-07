// Blobmixer Stylized Art Materials & Shaders

export const BLOBMIXER_MATERIAL_PRESETS = [
  {
    id: 'blobmixer_cosmic_fusion_live',
    name: 'Blobmixer: Cosmic Fusion',
    category: '?? Blobmixer MatCaps',
    type: 'shader',
    description: 'Organic jelly displacement with deep purple-magenta cosmic fusion and iridescent sheen.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#ff9a9e');
      grad.addColorStop(0.3, '#fecfef');
      grad.addColorStop(0.65, '#a18cd1');
      grad.addColorStop(1, '#3b1c54');
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
  float d = sin(pos.x * 4.0 + u_time * 1.5) * cos(pos.y * 4.0 + u_time * 1.2) * sin(pos.z * 4.0 + u_time * 1.8) * 0.15;
  pos += normal * d;
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
  float fresnel = pow(1.0 - max(0.0, dot(V, N)), 2.0);
  vec3 colA = vec3(0.98, 0.45, 0.72);
  vec3 colB = vec3(0.55, 0.22, 0.85);
  vec3 colC = vec3(0.15, 0.08, 0.32);
  float ramp = dot(N, vec3(0.0, 1.0, 0.5)) * 0.5 + 0.5;
  vec3 col = mix(colC, colB, ramp);
  col = mix(col, colA, fresnel * 0.8);
  col += vec3(1.0, 0.8, 0.95) * pow(fresnel, 3.5);
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'blobmixer_deep_ocean_live',
    name: 'Blobmixer: Deep Ocean Blue',
    category: '?? Blobmixer MatCaps',
    type: 'shader',
    description: 'Deep abyss blue with aqua highlights and metallic reflection.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#a1c4fd');
      grad.addColorStop(0.3, '#00d2ff');
      grad.addColorStop(0.7, '#003366');
      grad.addColorStop(1, '#000d1a');
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
  float d = sin(pos.y * 6.0 + u_time * 2.0) * cos(pos.x * 6.0 + u_time * 1.5) * 0.1;
  pos += normal * d;
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
  vec3 col = mix(vec3(0.0, 0.12, 0.35), vec3(0.0, 0.75, 0.95), dot(N, vec3(0.2, 0.8, 0.5)) * 0.5 + 0.5);
  col += vec3(0.7, 0.95, 1.0) * fresnel;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'blobmixer_synthwave_live',
    name: 'Blobmixer: Synthwave Chrome',
    category: '?? Blobmixer MatCaps',
    type: 'shader',
    description: 'Retro 80s synthwave horizon chrome reflection with electric pink and cyan edge glow.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#ff007f');
      grad.addColorStop(0.35, '#7928ca');
      grad.addColorStop(0.7, '#00f2fe');
      grad.addColorStop(1, '#0f051d');
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
  float bands = sin(N.y * 15.0 + u_time * 2.0) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.0, 0.85, 1.0), vec3(1.0, 0.05, 0.55), bands);
  col += vec3(1.0, 0.9, 0.2) * fresnel * 0.7;
  gl_FragColor = vec4(col, 1.0);
}`
  },
  {
    id: 'blobmixer_iridescent_live',
    name: 'Blobmixer: Iridescent Foil',
    category: '?? Blobmixer MatCaps',
    type: 'shader',
    description: 'Thin-film rainbow interference oil-slick with metallic sheen.',
    generate: (ctx, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = w * 0.5;
      const grad = ctx.createRadialGradient(cx * 0.65, cy * 0.35, 10, cx, cy, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#fbc2eb');
      grad.addColorStop(0.5, '#a6c1ee');
      grad.addColorStop(0.8, '#84fab0');
      grad.addColorStop(1, '#2c3e50');
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
  float d = dot(N, V);
  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (d * 1.5 + vec3(0.0, 0.33, 0.67) + u_time * 0.1));
  rainbow += vec3(0.3) * pow(1.0 - max(0.0, d), 3.0);
  gl_FragColor = vec4(rainbow, 1.0);
}`
  }
];
