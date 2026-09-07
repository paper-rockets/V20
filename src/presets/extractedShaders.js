import { DESKTOP_SHADERS_EXTRACTED } from './desktopShaders';
import { WONDERLUST_SHADERS_EXTRACTED } from './wonderlustShaders';
import { GODOT_SHADERS_EXTRACTED } from './godotShaders';
import { WAYFINDER_SHADERS_EXTRACTED } from './wayfinderShaders';
import { BLOBMIXER_SHADERS_EXTRACTED } from './blobmixerShaders';
import { GRASSWORKS_SHADERS_EXTRACTED } from './grassworksShaders';
import { REZE_SHADERS_EXTRACTED } from './rezeShaders';

export const EXTRACTED_SHADERS_DATA = [
    ...WAYFINDER_SHADERS_EXTRACTED,
    ...BLOBMIXER_SHADERS_EXTRACTED,
    ...GRASSWORKS_SHADERS_EXTRACTED,
    ...REZE_SHADERS_EXTRACTED,
    ...GODOT_SHADERS_EXTRACTED,
    ...WONDERLUST_SHADERS_EXTRACTED,
    ...DESKTOP_SHADERS_EXTRACTED,
    {
        "name":  "autostereogram",
        "path":  "shaders/autostereogram",
        "files":  {
                      "vertex.glsl":  "varying vec2 vUv;\r\n\r\nvoid main() {\r\n  vUv = uv;\r\n  gl_Position = vec4(position.xy, 0.0, 1.0);\r\n}\r\n",
                      "fragment.glsl":  "varying vec2 vUv;\r\n\r\nuniform sampler2D tBackground;\r\nuniform sampler2D tDepthMap;\r\n\r\nuniform vec2 uResolution;\r\nuniform float uBackgroundAspectRatio;\r\nuniform float uDepthMapAspectRatio;\r\n\r\nuniform int uSlices;\r\nuniform int uDepth;\r\nuniform float uZoom;\r\n\r\nuniform bool uShowDisplacement;\r\nuniform bool uShowDepthMap;\r\n\r\nvec4 depthMapAtCoordinates(vec2 coordinates) {\r\n  float x = coordinates.x - 0.5 / float(uSlices);\r\n  float y = coordinates.y;\r\n\r\n  float scaleFactor = float(uSlices - 1) / float(uSlices);\r\n  float effectiveAspectRatio = scaleFactor * uResolution.x / uResolution.y;\r\n\r\n  if (uDepthMapAspectRatio \u003c effectiveAspectRatio) {\r\n    // The image can be full height, scale width accordingly\r\n    x = (x - 0.5) * (uResolution.x / uResolution.y) / uDepthMapAspectRatio + 0.5;\r\n  } else {\r\n    // The image has the width of the aspect ratio, scale height accordingly\r\n    x = (x - 0.5) / effectiveAspectRatio * uResolution.x / uResolution.y + 0.5;\r\n    y = (y - 0.5) * uDepthMapAspectRatio / effectiveAspectRatio + 0.5;\r\n  }\r\n\r\n  x = (x - 0.5) / (0.1 * uZoom) + 0.5;\r\n  y = (y - 0.5) / (0.1 * uZoom) + 0.5;\r\n\r\n  if (x \u003c 0.0 || x \u003e 1.0 || y \u003c 0.0 || y \u003e 1.0) {\r\n    return vec4(vec3(0.0), 1.0);\r\n  }\r\n\r\n  return texture2D(tDepthMap, vec2(x, y));\r\n}\r\n\r\nvoid main() {\r\n  vec2 uv = vUv;\r\n\r\n  float depthAccumulator = 0.0;\r\n  for (int i = 0; i \u003c uSlices; i++) {\r\n    float x = uv.x - float(i) * 1.0 / float(uSlices);\r\n    float depth = depthMapAtCoordinates(vec2(x, uv.y)).r;\r\n    depthAccumulator += depth;\r\n\r\n    uv.x += depth * 0.001 * float(uDepth);\r\n  }\r\n\r\n  if (uShowDisplacement) {\r\n    float x = uv.x;\r\n    float y = uv.y * uResolution.y / uResolution.x * uBackgroundAspectRatio;\r\n\r\n    gl_FragColor = vec4(vec3(depthAccumulator) / float(uSlices), 1.0);\r\n  } else if (uShowDepthMap) {\r\n    gl_FragColor = depthMapAtCoordinates(vUv + vec2(0.5 / float(uSlices), 0.0));\r\n  } else {\r\n    float x = uv.x * float(uSlices);\r\n    float y = uv.y * float(uSlices) * uResolution.y / uResolution.x * uBackgroundAspectRatio;\r\n\r\n    gl_FragColor = texture2D(tBackground, vec2(x, y));\r\n  }\r\n}\r\n"
                  }
    },
    {
        "name":  "ghost",
        "path":  "shaders/ghost",
        "files":  {
                      "shader.vert":  "precision mediump float;\r\n\r\nattribute vec3 a_position;\r\nattribute vec3 a_normals;\r\nvarying vec3 v_normals;\r\nvarying vec2 v_position;\r\nuniform float u_time;\r\nuniform mat3 u_normals;\r\nuniform mat4 u_view, u_projection, u_model;\r\n\r\nvoid main() {\r\n  v_normals = u_normals * a_normals;\r\n  v_position = a_position.xy;\r\n\r\n  vec4 position = vec4(a_position, 1.0);\r\n\r\n  // Move in circle horizontaly\r\n  position.x += 0.1 * sin(u_time * 0.02);\r\n  position.z += 0.1 * cos(u_time * 0.02);\r\n\r\n  // Ripples\r\n  position.x += 0.2 * sin(position.y + (position.y * 4.0 + u_time) * 0.04);\r\n  position.z += 0.2 * cos(position.y + (position.y * 4.0 + u_time) * 0.04);\r\n\r\n  // Top to bottom\r\n  position.y += 0.85 * cos(u_time * 0.014);\r\n\r\n  gl_Position = u_projection * u_view * u_model * position;\r\n}\r\n",
                      "shader.frag":  "precision mediump float;\r\n\r\nvarying vec3 v_normals;\r\nvarying vec2 v_position;\r\n\r\nvoid main() {\r\n  vec3 color = vec3(0.2);\r\n  vec3 lightDir = vec3(1, 1, 0);\r\n  vec3 ambient = 0. * color;\r\n  vec3 diffuse = 3.0 * color * clamp(dot(v_normals, lightDir), 0.0, 6.0);\r\n\r\n  gl_FragColor = vec4(ambient + diffuse, 1.0);\r\n}\r\n",
                      "post.frag":  "precision lowp float;\r\nvarying vec2 v_uv;\r\nuniform sampler2D u_texture;\r\n\r\nvoid main() {\r\n  vec4 color = texture2D(u_texture, v_uv);\r\n  gl_FragColor = color;\r\n}\r\n",
                      "post.vert":  "precision mediump float;\r\nattribute vec2 a_position;\r\nvarying vec2 v_uv;\r\n\r\nvoid main() {\r\n  v_uv = 0.5 * (a_position + 1.0);\r\n  gl_Position = vec4(a_position, 0, 1);\r\n}\r\n"
                  }
    },
    {
        "name":  "grid-deformation",
        "path":  "shaders/grid-deformation",
        "files":  {
                      "default.vert":  "precision mediump float;\r\nattribute vec3 a_position;\r\nuniform vec2 u_mouse;\r\nuniform mat4 u_projection, u_model, u_view;\r\nuniform float u_time;\r\n\r\nfloat elevation = -0.2;\r\nfloat mean = 0.0;\r\nfloat std = 0.2;\r\nfloat pi = 3.14159;\r\nfloat e = 2.71828;\r\n\r\nfloat bell(float x) {\r\n  return pow(\r\n    e / (std * sqrt(2.0 * pi)),\r\n    -0.5 * pow((x - mean) / std, 2.0)\r\n  );\r\n}\r\n\r\nvoid main() {\r\n  vec4 position = vec4(a_position, 1.0);\r\n\r\n  float distance = distance(vec2(position.x, position.y), u_mouse);\r\n  float ratio = bell(distance);\r\n  position.z += elevation * ratio;\r\n\r\n  position.x += 0.01 * sin(u_time * 0.04 + 10.0 * (a_position.x + a_position.y));\r\n  position.y += 0.01 * cos(u_time * 0.04 + 10.0 * (a_position.x + a_position.y));\r\n\r\n  gl_PointSize = 2.0 + 3.0 * ratio;\r\n  gl_Position = u_projection * u_view * u_model * position;\r\n}\r\n",
                      "default.frag":  "precision mediump float;\r\n\r\nvoid main() {\r\n  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);\r\n}\r\n"
                  }
    },
    {
        "name":  "masked-images",
        "path":  "shaders/masked-images",
        "files":  {
                      "vertex.glsl":  "attribute vec2 a_position;\r\nattribute vec2 a_texcoord;\r\nattribute float a_scroll;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\nvarying float v_scroll;\r\n\r\nuniform float u_time;\r\n\r\nvoid main() {\r\n  float positionX = a_position.x;\r\n  float positionY = a_position.y;\r\n\r\n  vec2 position = vec2(positionX, positionY);\r\n\r\n  gl_Position = vec4(position, 0, 1);\r\n  v_texcoord = a_texcoord;\r\n  v_position = position;\r\n  v_scroll = a_scroll;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\nvarying float v_scroll;\r\n\r\nuniform sampler2D u_texture;\r\n\r\nvoid main() {\r\n  float texcoordX = v_texcoord.x;\r\n  float texcoordY = v_texcoord.y;\r\n\r\n  vec4 color;\r\n  vec4 white = vec4(1.0, 1.0, 1.0, 0.0);\r\n\r\n  float parallax = 0.05;\r\n  float offsetY = -v_position.y * parallax;\r\n  float zoom = -0.2 * (1.0 - cos(-max(0.0, (-v_scroll + 0.75))));\r\n\r\n  color = texture2D(u_texture, vec2((texcoordX - 0.5) * (1.0 - parallax * 2.0 + zoom) + 0.5, (texcoordY - 0.5) * (1.0 - parallax * 2.0 + zoom) + 0.5 + offsetY));\r\n\r\n  // Paddings\r\n  if (\r\n    (texcoordX \u003c 0.33 \u0026\u0026 texcoordY \u003c 0.15) ||\r\n    (texcoordX \u003c 0.33 \u0026\u0026 texcoordY \u003e 0.9) ||\r\n    (texcoordX \u003e 0.33 \u0026\u0026 texcoordX \u003c 0.66 \u0026\u0026 texcoordY \u003e 0.8) ||\r\n    (texcoordX \u003e 0.66 \u0026\u0026 texcoordY \u003c 0.3)\r\n  ) {\r\n    color = white;\r\n  }\r\n\r\n  // Barre verticale 1\r\n  if (texcoordX \u003e 0.32 \u0026\u0026 texcoordX \u003c 0.34) {\r\n    color = white;\r\n  }\r\n\r\n  // Barre verticale 2\r\n  if (texcoordX \u003e 0.65 \u0026\u0026 texcoordX \u003c 0.67) {\r\n    color = white;\r\n  }\r\n\r\n  gl_FragColor = color;\r\n}\r\n"
                  }
    },
    {
        "name":  "poster",
        "path":  "shaders/poster",
        "files":  {
                      "vertex.glsl":  "precision mediump float;\r\n\r\nuniform vec2 u_resolution;\r\n\r\nattribute vec4 a_position;\r\nattribute vec2 a_texcoord;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec4 v_position;\r\n\r\nvoid main() {\r\n  vec4 position = a_position;\r\n  position.xy = (position.xy / u_resolution * 2.0) * vec2(1.0, -1.0);\r\n\r\n  gl_Position = position;\r\n  v_texcoord = a_texcoord;\r\n  v_position = position;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nuniform sampler2D u_carTexture;\r\nuniform sampler2D u_carCutoutTexture;\r\nuniform sampler2D u_paperTexture;\r\nuniform vec2 u_resolution;\r\nuniform float u_time;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec4 v_position;\r\n\r\nvec4 toBW(vec4 color) {\r\n  float luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;\r\n  return vec4(luminance, luminance, luminance, color.a);\r\n}\r\n\r\nvoid main() {\r\n  vec2 texcoord = (v_texcoord - 0.5) + 0.5;\r\n\r\n  vec4 carColor = toBW(texture2D(u_carTexture, texcoord));\r\n  vec4 carCutoutColor = toBW(texture2D(u_carCutoutTexture, texcoord));\r\n\r\n  float lift = 0.15;\r\n  float intensity = 2.0;\r\n  float circleWidth = 0.5 + 0.05 * sin(u_time);\r\n  vec2 circlePos = vec2(0.5, 0.52 - 0.02 * sin(u_time));\r\n\r\n  vec4 paperColor = intensity * texture2D(u_paperTexture, texcoord);\r\n  paperColor.rgb += 0.2;\r\n\r\n  vec4 circle = vec4(1.0, 0.2, 0.0, 0.0);\r\n  float aspectRatio = u_resolution.x / u_resolution.y;\r\n  vec2 offset = vec2(1.0 - 2.0 * circlePos.x, -1.0 + 2.0 * circlePos.y);\r\n  vec2 pos = vec2(1.0, 1.0 / aspectRatio) * (v_position.xy + offset);\r\n\r\n  if (pow(pos.x, 2.0) + pow(pos.y, 2.0) \u003c pow(circleWidth, 2.0)) {\r\n    circle.a = 1.0;\r\n  }\r\n\r\n  vec4 composition = carColor;\r\n  composition = mix(composition, circle, circle.a);\r\n  composition = mix(composition, carCutoutColor, carCutoutColor.a);\r\n\r\n  vec4 color = (1.0 - lift) * composition + paperColor;\r\n\r\n  gl_FragColor = color;\r\n}\r\n"
                  }
    },
    {
        "name":  "slider",
        "path":  "shaders/slider",
        "files":  {
                      "vertex.glsl":  "precision mediump float;\r\n\r\nuniform vec2 u_resolution;\r\nuniform float u_scale;\r\nuniform float u_time;\r\nuniform float u_hover;\r\nuniform mat4 u_view;\r\n// uniform float u_open;\r\n\r\nattribute vec4 a_position;\r\nattribute vec2 a_texcoord;\r\n\r\nvarying vec2 v_texcoord;\r\n\r\nvoid main() {\r\n  vec4 position = a_position;\r\n  position = u_view * position;\r\n\r\n  vec2 scale = vec2(pow(u_scale, 2.0), -pow(u_scale, 2.0));\r\n  position.xy = scale * (position.xy / u_resolution * 2.0) + vec2(-1.0, 1.0);\r\n\r\n  gl_Position = position;\r\n  v_texcoord = a_texcoord;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nuniform sampler2D u_texture;\r\nuniform vec2 u_textureScale;\r\nuniform float u_zoom;\r\nuniform float u_hover;\r\nuniform float u_open;\r\n\r\nvarying vec2 v_texcoord;\r\n\r\nvoid main() {\r\n  vec2 texcoord = (v_texcoord - 0.5) * u_textureScale * (1.0 / u_zoom) + 0.5;\r\n  vec4 color = texture2D(u_texture, texcoord);\r\n  vec4 bw =\r\n      mix(vec4(vec3(color.r + color.g + color.b) * 0.33, 1.0), vec4(1.0), 0.3);\r\n\r\n  color = mix(color, bw, max(0.0, u_hover * cos(u_open * 3.1415)));\r\n\r\n  gl_FragColor = color;\r\n}\r\n"
                  }
    },
    {
        "name":  "twgl.js",
        "path":  "shaders/twgl.js",
        "files":  {
                      "vertex.glsl":  "attribute vec4 position;\r\n\r\nvoid main() {\r\n  gl_Position = position;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nuniform vec2 resolution;\r\nuniform float time;\r\n\r\nvoid main() {\r\n  vec2 uv = gl_FragCoord.xy / resolution;\r\n  float color = 0.0;\r\n  // lifted from glslsandbox.com\r\n  color += sin( uv.x * cos( time / 3.0 ) * 60.0 ) + cos( uv.y * cos( time / 2.80 ) * 10.0 );\r\n  color += sin( uv.y * sin( time / 2.0 ) * 40.0 ) + cos( uv.x * sin( time / 1.70 ) * 40.0 );\r\n  color += sin( uv.x * sin( time / 1.0 ) * 10.0 ) + sin( uv.y * sin( time / 3.50 ) * 80.0 );\r\n  color *= sin( time / 10.0 ) * 0.5;\r\n\r\n  gl_FragColor = vec4( vec3( color * 0.5, sin( color + time / 2.5 ) * 0.75, color ), 1.0 );\r\n}\r\n"
                  }
    },
    {
        "name":  "webgl-demo",
        "path":  "shaders/webgl-demo",
        "files":  {
                      "vertex.glsl":  "attribute vec2 a_position;\r\nattribute vec2 a_texcoord;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\n\r\nuniform float u_time;\r\n\r\nvoid main() {\r\n  float positionX = a_position.x;\r\n  float positionY = a_position.y;\r\n\r\n  positionX = positionX + 0.1 * a_position.x * sin((0.5 + 0.5 * positionY) * 3.14);\r\n  positionY = positionY + 0.005 * sin(20.0 * positionX + 0.05 * u_time);\r\n\r\n  vec2 position = vec2(positionX, positionY);\r\n\r\n  gl_Position = vec4(position, 0, 1);\r\n  v_texcoord = a_texcoord;\r\n  v_position = position;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\n\r\nuniform sampler2D u_texture;\r\n\r\nvoid main() {\r\n  float texcoordX = v_texcoord.x;\r\n  float texcoordY = v_texcoord.y;\r\n\r\n  float offsetX = 0.02 * v_position.x * sin((0.5 + v_position.y) * 3.14);\r\n\r\n  float red = texture2D(u_texture, vec2(v_texcoord.x - offsetX, v_texcoord.y)).x;\r\n  float green = texture2D(u_texture, vec2(v_texcoord.x, v_texcoord.y)).y;\r\n  float blue = texture2D(u_texture, vec2(v_texcoord.x, v_texcoord.y)).z;\r\n\r\n  gl_FragColor = vec4(red, green, blue, 1.0);\r\n}\r\n"
                  }
    },
    {
        "name":  "webgl-gradient",
        "path":  "shaders/webgl-gradient",
        "files":  {
                      "vertex.glsl":  "precision mediump float;\r\n\r\nuniform vec2 u_resolution;\r\n\r\nattribute vec4 a_position;\r\nattribute vec4 a_color_1;\r\nattribute vec4 a_color_2;\r\n\r\nvarying vec4 v_position;\r\nvarying vec4 v_color_1;\r\nvarying vec4 v_color_2;\r\n\r\nvoid main() {\r\n  vec4 position = a_position;\r\n  position.xy = (position.xy / u_resolution * 2.0) * vec2(1.0, -1.0);\r\n\r\n  gl_Position = position;\r\n  v_position = position;\r\n  v_color_1 = a_color_1;\r\n  v_color_2 = a_color_2;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nvarying vec4 v_color_1;\r\nvarying vec4 v_color_2;\r\n\r\nuniform float u_time;\r\n\r\nvec3 rgb2hsv(vec3 c) {\r\n  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\r\n  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\r\n  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\r\n\r\n  float d = q.x - min(q.w, q.y);\r\n  float e = 1.0e-10;\r\n  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);\r\n}\r\n\r\nvec3 hsv2rgb(vec3 c) {\r\n  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\r\n  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\r\n  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\r\n}\r\n\r\nvoid main() {\r\n  gl_FragColor =\r\n      vec4(hsv2rgb(mix(rgb2hsv(v_color_1.rgb), rgb2hsv(v_color_2.rgb),\r\n                       0.5 + 0.5 * sin(u_time * 0.5))),\r\n           1.0);\r\n}\r\n"
                  }
    },
    {
        "name":  "webgl-photo-editing",
        "path":  "shaders/webgl-photo-editing",
        "files":  {
                      "vertex.glsl":  "attribute vec2 a_position;\r\nattribute vec2 a_texcoord;\r\n\r\nvarying vec2 v_texcoord;\r\n\r\nvoid main() {\r\n  gl_Position = vec4(a_position, 0, 1);\r\n  v_texcoord = a_texcoord;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nvarying vec2 v_texcoord;\r\n\r\nuniform sampler2D u_texture;\r\nuniform float u_brightness;\r\nuniform float u_highlights;\r\nuniform float u_shadows;\r\nuniform float u_contrast;\r\nuniform float u_saturation;\r\nuniform float u_grain;\r\n\r\nfloat random (vec2 st) {\r\n  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);\r\n}\r\n\r\nvoid main() {\r\n  vec4 sampleColor = texture2D(u_texture, v_texcoord);\r\n\r\n  // Brightness\r\n  sampleColor = vec4(clamp(sampleColor.rgb + u_brightness, 0.0, 1.0), 1.0);\r\n\r\n  // Highlights\r\n  // TODO: Use soft knee\r\n  sampleColor = vec4(min(sampleColor.rgb, 0.5) + u_highlights * clamp(sampleColor.rgb - 0.5, 0.0, 0.5), 1.0);\r\n\r\n  // Shadows\r\n  // TODO: Use soft knee\r\n  if (sampleColor.r + sampleColor.g + sampleColor.b \u003c 1.5) {\r\n    sampleColor = vec4((u_shadows * (sampleColor.rgb - 0.5)) + 0.5, 1.0);\r\n  }\r\n\r\n  // Contrast\r\n  sampleColor = vec4(u_contrast * (sampleColor.rgb - 0.5) + 0.5, 1.0);\r\n\r\n  // Saturation\r\n  float desaturated = (sampleColor.x + sampleColor.y + sampleColor.z) / 3.0;\r\n  sampleColor = (1.0 - u_saturation) * vec4(vec3(desaturated), 1) + u_saturation * sampleColor;\r\n\r\n  // Grain\r\n  // TODO: Improve next line by passing resolution uniform\r\n  vec2 st = gl_FragCoord.xy / 1000.0;\r\n  float rnd = random(st);\r\n  sampleColor = mix(sampleColor, vec4(sampleColor.rgb * (0.5 + vec3(rnd)), 1.0), u_grain);\r\n\r\n  gl_FragColor = sampleColor;\r\n}\r\n"
                  }
    },
    {
        "name":  "zoomed-images",
        "path":  "shaders/zoomed-images",
        "files":  {
                      "vertex.glsl":  "attribute vec2 a_position;\r\nattribute vec2 a_texcoord;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\nvarying float v_logistic_y;\r\n\r\nuniform float u_time;\r\n\r\nfloat logistic(float x) {\r\n  float mid_point = 0.0;\r\n  float max_point = 1.0;\r\n  float steepness = 3.0;\r\n\r\n  return max_point / (1.0 + exp(-steepness * (x - mid_point)));\r\n}\r\n\r\nvoid main() {\r\n  float positionX = a_position.x;\r\n  float positionY = a_position.y;\r\n\r\n  float logisticY = 2.0 * (logistic(positionY) - 0.5);\r\n  float strengthX = sin(positionX * 0.5 * 3.14);\r\n  float strengthY = sin((positionY + 1.0) * 0.5 * 3.14);\r\n\r\n  positionY = positionY + strengthX * strengthY * (logisticY - positionY);\r\n\r\n  vec2 position = vec2(positionX, positionY);\r\n\r\n  gl_Position = vec4(position, 0, 1);\r\n  v_texcoord = a_texcoord;\r\n  v_position = position;\r\n}\r\n",
                      "fragment.glsl":  "precision mediump float;\r\n\r\nvarying vec2 v_texcoord;\r\nvarying vec2 v_position;\r\n\r\nuniform sampler2D u_texture;\r\n\r\nvoid main() {\r\n  float texcoordX = v_texcoord.x;\r\n  float texcoordY = v_texcoord.y;\r\n\r\n  gl_FragColor = texture2D(u_texture, v_texcoord);\r\n}\r\n"
                  }
    }
];
