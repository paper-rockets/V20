import { DESKTOP_SHADERS_CREATOR } from './desktopShaders';

export const SHADER_PRESETS = [
  {
    id: 'matcap-custom',
    name: 'MatCap Studio (Custom GLSL)',
    category: '3D Materials',
    description: 'Custom view-space MatCap calculation with controllable rim power, normal distortion, and tint.',
    vertexShader: `precision mediump float;

varying vec2 v_matcap_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
  v_normal = normalize(normalMatrix * normal);
  vec4 mv_position = modelViewMatrix * vec4(position, 1.0);
  v_view_pos = -mv_position.xyz;

  // View-space normal mapped to [0, 1] texture coordinates for MatCap
  vec3 view_normal = normalize(v_normal);
  v_matcap_uv = view_normal.xy * 0.5 + 0.5;

  gl_Position = projectionMatrix * mv_position;
}`,
    fragmentShader: `precision mediump float;

uniform sampler2D u_matcap;
uniform float u_time;
uniform vec3 u_tint;
uniform float u_rim_power;
uniform float u_roughness;

varying vec2 v_matcap_uv;
varying vec3 v_normal;
varying vec3 v_view_pos;

void main() {
  vec2 uv = v_matcap_uv;
  
  // Sample the MatCap texture (drawn live on canvas or loaded)
  vec4 matcap_color = texture2D(u_matcap, uv);

  // Calculate rim lighting / Fresnel
  vec3 view_dir = normalize(v_view_pos);
  float rim = 1.0 - max(dot(view_dir, normalize(v_normal)), 0.0);
  rim = pow(rim, max(u_rim_power, 0.1));

  vec3 final_color = matcap_color.rgb * u_tint + vec3(rim * 0.3);
  gl_FragColor = vec4(final_color, 1.0);
}`,
    uniforms: {
      u_tint: { type: 'color', label: 'Color Tint', value: '#ffffff' },
      u_rim_power: { type: 'range', label: 'Rim Power', value: 3.0, min: 0.1, max: 10.0, step: 0.1 },
      u_roughness: { type: 'range', label: 'Roughness', value: 0.5, min: 0.0, max: 1.0, step: 0.01 }
    }
  },
  {
    id: 'toon-cel-outline',
    name: 'Toon / Cel Shading',
    category: 'Stylized & Toon',
    description: 'Banded discrete lighting levels with dynamic rim highlight and stylized anime shading.',
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

uniform vec3 u_light_dir;
uniform vec3 u_tint;
uniform float u_steps;

varying vec3 v_normal;
varying vec3 v_view_dir;

void main() {
  vec3 light = normalize(u_light_dir);
  float diff = dot(v_normal, light);
  
  // Quantize diffuse lighting into steps
  float intensity = floor((diff * 0.5 + 0.5) * u_steps) / u_steps;

  // Rim light
  float rim = 1.0 - max(dot(v_view_dir, v_normal), 0.0);
  rim = step(0.65, rim);

  vec3 color = u_tint * intensity + vec3(rim * 0.4);
  gl_FragColor = vec4(color, 1.0);
}`,
    uniforms: {
      u_tint: { type: 'color', label: 'Cel Color', value: '#e67e22' },
      u_steps: { type: 'range', label: 'Shading Bands', value: 4.0, min: 2.0, max: 10.0, step: 1.0 },
      u_light_dir: { type: 'vector', label: 'Light Vector', value: [1.0, 1.0, 0.5] }
    }
  },
  {
    id: 'flat-graphic-solid',
    name: 'Flat Graphic Silhouette',
    category: 'Flat & Graphic',
    description: 'Zero-shading pure graphic solid silhouette with controllable outline threshold.',
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

uniform vec3 u_flat_color;
uniform vec3 u_outline_color;
uniform float u_outline_thickness;

varying vec3 v_normal;
varying vec3 v_view_dir;

void main() {
  float edge = dot(normalize(v_normal), normalize(v_view_dir));
  float is_outline = step(edge, u_outline_thickness);

  vec3 final_color = mix(u_flat_color, u_outline_color, is_outline);
  gl_FragColor = vec4(final_color, 1.0);
}`,
    uniforms: {
      u_flat_color: { type: 'color', label: 'Flat Solid Color', value: '#ffffff' },
      u_outline_color: { type: 'color', label: 'Outline Color', value: '#111118' },
      u_outline_thickness: { type: 'range', label: 'Outline Border', value: 0.25, min: 0.0, max: 0.6, step: 0.02 }
    }
  },
  {
    id: 'webgl-gradient',
    name: 'WebGL Multi-Color Gradient',
    category: 'Extracted / Julien Verneaut',
    description: 'Extracted verbatim from Julien Verneaut laboratoire. Smooth HSV color space gradient animation.',
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
uniform vec3 u_color_1;
uniform vec3 u_color_2;

varying vec3 v_normal;
varying vec2 v_uv;

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
  vec3 col1 = rgb2hsv(u_color_1);
  vec3 col2 = rgb2hsv(u_color_2);
  float mix_val = 0.5 + 0.5 * sin(u_time * 1.5 + v_normal.x * 2.0 + v_normal.y * 2.0);
  vec3 result = hsv2rgb(mix(col1, col2, mix_val));
  gl_FragColor = vec4(result, 1.0);
}`,
    uniforms: {
      u_color_1: { type: 'color', label: 'Gradient Start', value: '#ff5e62' },
      u_color_2: { type: 'color', label: 'Gradient End', value: '#ff9966' }
    }
  },
  {
    id: 'twgl-plasma',
    name: 'TWGL Plasma Waves',
    category: 'Extracted / Julien Verneaut',
    description: 'Extracted verbatim from Julien Verneaut twgl.js experiment. Trigonometric sinusoidal plasma waves.',
    vertexShader: `precision mediump float;

varying vec2 v_uv;
varying vec3 v_position;

void main() {
  v_uv = uv;
  v_position = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform float u_scale;

varying vec2 v_uv;

void main() {
  vec2 uv = v_uv * u_scale;
  float t = u_time * u_speed;
  float color = 0.0;

  color += sin( uv.x * cos( t / 3.0 ) * 60.0 ) + cos( uv.y * cos( t / 2.80 ) * 10.0 );
  color += sin( uv.y * sin( t / 2.0 ) * 40.0 ) + cos( uv.x * sin( t / 1.70 ) * 40.0 );
  color += sin( uv.x * sin( t / 1.0 ) * 10.0 ) + sin( uv.y * sin( t / 3.50 ) * 80.0 );
  color *= sin( t / 10.0 ) * 0.5;

  gl_FragColor = vec4( vec3( color * 0.5, sin( color + t / 2.5 ) * 0.75, color ), 1.0 );
}`,
    uniforms: {
      u_speed: { type: 'range', label: 'Wave Speed', value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      u_scale: { type: 'range', label: 'Grid Scale', value: 1.0, min: 0.2, max: 4.0, step: 0.1 }
    }
  },
  {
    id: 'photo-fx',
    name: 'WebGL Photo FX & Grain',
    category: 'Extracted / Julien Verneaut',
    description: 'Extracted verbatim from Julien Verneaut photo editing experiment. Real-time grain, contrast, brightness, shadows & saturation.',
    vertexShader: `precision mediump float;

varying vec2 v_texcoord;
varying vec3 v_normal;

void main() {
  v_normal = normalize(normalMatrix * normal);
  v_texcoord = normal.xy * 0.5 + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_matcap;
uniform float u_brightness;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_grain;

float random (vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vec4 sampleColor = texture2D(u_matcap, v_texcoord);

  // Brightness
  sampleColor = vec4(clamp(sampleColor.rgb + u_brightness, 0.0, 1.0), 1.0);

  // Highlights
  sampleColor = vec4(min(sampleColor.rgb, 0.5) + u_highlights * clamp(sampleColor.rgb - 0.5, 0.0, 0.5), 1.0);

  // Shadows
  if (sampleColor.r + sampleColor.g + sampleColor.b < 1.5) {
    sampleColor = vec4((u_shadows * (sampleColor.rgb - 0.5)) + 0.5, 1.0);
  }

  // Contrast
  sampleColor = vec4(u_contrast * (sampleColor.rgb - 0.5) + 0.5, 1.0);

  // Saturation
  float desaturated = (sampleColor.x + sampleColor.y + sampleColor.z) / 3.0;
  sampleColor = (1.0 - u_saturation) * vec4(vec3(desaturated), 1) + u_saturation * sampleColor;

  // Grain
  vec2 st = gl_FragCoord.xy / 500.0;
  float rnd = random(st);
  sampleColor = mix(sampleColor, vec4(sampleColor.rgb * (0.5 + vec3(rnd)), 1.0), u_grain);

  gl_FragColor = sampleColor;
}`,
    uniforms: {
      u_brightness: { type: 'range', label: 'Brightness', value: 0.0, min: -1.0, max: 1.0, step: 0.05 },
      u_contrast: { type: 'range', label: 'Contrast', value: 1.0, min: 0.0, max: 3.0, step: 0.05 },
      u_saturation: { type: 'range', label: 'Saturation', value: 1.0, min: 0.0, max: 2.5, step: 0.05 },
      u_highlights: { type: 'range', label: 'Highlights', value: 1.0, min: 0.0, max: 2.0, step: 0.05 },
      u_shadows: { type: 'range', label: 'Shadows', value: 1.0, min: 0.0, max: 2.0, step: 0.05 },
      u_grain: { type: 'range', label: 'Film Grain', value: 0.25, min: 0.0, max: 1.0, step: 0.02 }
    }
  },
  {
    id: 'ghost-fresnel',
    name: 'Ghost & Translucent Fresnel',
    category: 'Extracted / Julien Verneaut',
    description: 'Extracted verbatim from Julien Verneaut ghost shader. Ghostly silhouette with diffuse light and ambient glow.',
    vertexShader: `precision mediump float;

varying vec3 v_normals;
varying vec3 v_view_pos;

void main() {
  v_normals = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  v_view_pos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `precision mediump float;

varying vec3 v_normals;
varying vec3 v_view_pos;

uniform vec3 u_light_dir;
uniform vec3 u_ghost_color;
uniform float u_diffuse_intensity;

void main() {
  vec3 color = u_ghost_color;
  vec3 lightDir = normalize(u_light_dir);
  vec3 ambient = 0.2 * color;
  vec3 diffuse = u_diffuse_intensity * color * clamp(dot(v_normals, lightDir), 0.0, 1.0);

  vec3 view_dir = normalize(v_view_pos);
  float rim = 1.0 - max(dot(view_dir, v_normals), 0.0);
  rim = pow(rim, 2.5);

  gl_FragColor = vec4(ambient + diffuse + vec3(rim * 0.8), 0.85);
}`,
    uniforms: {
      u_ghost_color: { type: 'color', label: 'Ghost Tint', value: '#50c8c8' },
      u_diffuse_intensity: { type: 'range', label: 'Diffuse Power', value: 2.0, min: 0.5, max: 5.0, step: 0.1 },
      u_light_dir: { type: 'vector', label: 'Light Direction', value: [1, 1, 1] }
    }
  },
  {
    id: 'vertex-wave-displacement',
    name: 'Dynamic Vertex Waves & Distortion',
    category: 'Vertex Animation',
    description: 'Vertex displacement shader animating normal wave frequencies and morphing geometry in real time.',
    vertexShader: `precision mediump float;

uniform float u_time;
uniform float u_wave_frequency;
uniform float u_wave_height;

varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;

void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;

  vec3 pos = position;
  float wave = sin(pos.y * u_wave_frequency + u_time * 3.0) * cos(pos.x * u_wave_frequency + u_time * 2.0);
  pos += normal * (wave * u_wave_height);

  v_position = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`,
    fragmentShader: `precision mediump float;

uniform float u_time;
uniform vec3 u_base_color;
uniform sampler2D u_matcap;

varying vec3 v_normal;
varying vec3 v_position;
varying vec2 v_uv;

void main() {
  vec2 matcap_uv = normalize(v_normal).xy * 0.5 + 0.5;
  vec4 matcap = texture2D(u_matcap, matcap_uv);

  float stripe = sin(v_position.y * 10.0 + u_time * 4.0) * 0.5 + 0.5;
  vec3 col = mix(matcap.rgb * u_base_color, vec3(stripe), 0.3);

  gl_FragColor = vec4(col, 1.0);
}`,
    uniforms: {
      u_base_color: { type: 'color', label: 'Base Color', value: '#6a11cb' },
      u_wave_frequency: { type: 'range', label: 'Wave Frequency', value: 3.5, min: 0.5, max: 10.0, step: 0.1 },
      u_wave_height: { type: 'range', label: 'Wave Amplitude', value: 0.25, min: 0.0, max: 1.0, step: 0.01 }
    }
  },
  {
    id: 'iridescent-hologram',
    name: 'Holographic Iridescence',
    category: 'Procedural Shader',
    description: 'Thin-film rainbow interference and specular iridescent glow reacting dynamically to view angle.',
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
uniform float u_frequency;
uniform float u_glow;

varying vec3 v_normal;
varying vec3 v_view_dir;

vec3 rainbow(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float fresnel = 1.0 - max(dot(v_normal, v_view_dir), 0.0);
  float angle = fresnel * u_frequency + u_time * 0.5;
  vec3 iridescent_color = rainbow(angle);

  vec3 final_color = iridescent_color * (pow(fresnel, 1.5) * u_glow + 0.35);
  gl_FragColor = vec4(final_color, 1.0);
}`,
    uniforms: {
      u_frequency: { type: 'range', label: 'Color Bands', value: 4.0, min: 1.0, max: 12.0, step: 0.2 },
      u_glow: { type: 'range', label: 'Iridescent Glow', value: 2.0, min: 0.5, max: 5.0, step: 0.1 }
    }
  },
  ...DESKTOP_SHADERS_CREATOR
];
