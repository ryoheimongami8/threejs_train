import * as THREE from 'three';

// Full-screen composite. uOut selects what is written:
//   0 final image   1 line layer (ink colour, alpha=line)   2 edit-ID as RGB   3 mask/line-group as RGB
const frag = /* glsl */`
precision highp float;
precision highp int;
uniform sampler2D tColor, tGeo, tId;
uniform vec2 uRes;
uniform int uOut, uMode;
uniform float uHazeStart, uAO, uFocal, uBloom, uExposure, uSat, uTint, uHaze, uBands, uLineStrength, uLineWidth, uCrease, uDepth;
uniform vec3 uHazeColor;
out vec4 outColor;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
vec3 toSrgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
float lineW(float g){ return g < 0.5 ? 0. : g < 1.5 ? 1. : g < 2.5 ? .45 : g < 3.5 ? .22 : .18; }

// returns line amount 0..1 at integer pixel p
float lineAt(ivec2 p, int w){
  ivec2 hi = ivec2(uRes) - 1;
  vec4 gC = texelFetch(tGeo, p, 0), iC = texelFetch(tId, p, 0);
  float e = 0.;
  const ivec2 dirs[8] = ivec2[8](ivec2(1,0), ivec2(-1,0), ivec2(0,1), ivec2(0,-1), ivec2(1,1), ivec2(-1,-1), ivec2(1,-1), ivec2(-1,1));
  for (int k = 0; k < 8; k++) {
    ivec2 q = clamp(p + dirs[k]*w, ivec2(0), hi);
    vec4 g = texelFetch(tGeo, q, 0), i = texelFetch(tId, q, 0);
    float far = smoothstep(14., 75., min(gC.w, g.w));
    float fade = mix(1., 0.12, far);
    float wl = max(lineW(iC.z), lineW(i.z));
    float idDiff = step(0.5, abs(iC.x - i.x));
    float ndiff = 1. - dot(gC.xyz, g.xyz);
    float crease = smoothstep(uCrease, uCrease * 1.7, ndiff) * lineW(iC.z) * 0.8;
    float dd = abs(gC.w - g.w) / max(min(gC.w, g.w), 1.);
    float depthE = smoothstep(uDepth, uDepth * 2.2, dd) * lineW(iC.z) * 0.7;
    float v = idDiff > 0.5 ? wl : max(crease, depthE);
    e = max(e, v * fade);
  }
  return e;
}

// cheap screen-space contact shadow from the linear depth buffer (narrow radius, fades with distance)
float aoAt(ivec2 p, float d){
  if (d > 110.) return 1.;
  float R = clamp(0.55 * uFocal / d, 2., 90.);
  float occ = 0.;
  ivec2 hi = ivec2(uRes) - 1;
  for (int i = 0; i < 14; i++) {
    float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 14.) * R;
    ivec2 q = clamp(p + ivec2(vec2(cos(a), sin(a)) * rr), ivec2(0), hi);
    float diff = d - texelFetch(tGeo, q, 0).w;
    occ += smoothstep(0.08, 0.35, diff) * (1. - smoothstep(0.9, 2.0, diff));
  }
  return 1. - occ / 14.;
}

void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 geo = texelFetch(tGeo, p, 0);
  vec4 idv = texelFetch(tId, p, 0);

  if (uOut == 2) { int v = int(idv.x + 0.5); outColor = vec4(float(v & 255), float((v >> 8) & 255), float((v >> 16) & 255), 255.) / 255.; return; }
  if (uOut == 3) { outColor = vec4(idv.y / 12., idv.z / 4., 0., 1.); return; }

  int w = max(1, int(floor(uLineWidth * uRes.y / 1080. + 0.5)));
  float ln = (uMode == 0) ? 0. : lineAt(p, w) * uLineStrength;

  vec3 c = texture(tColor, uv).rgb * uExposure;
  if (uBloom > 0.) { // soft glow from sunlit / sky highlights
    vec3 b = vec3(0.);
    float rad = uRes.y / 1080. * 9.;
    for (int i = 0; i < 20; i++) {
      float a = float(i) * 2.39996, r = sqrt((float(i) + .5) / 20.) * rad * 2.2;
      vec3 t = texture(tColor, uv + vec2(cos(a), sin(a)) * r / uRes).rgb * uExposure;
      b += max(t - 0.85, 0.);
    }
    c += b / 20. * uBloom * 1.6;
  }
  bool sky = idv.y < 0.5;
  if (uMode != 0 && uAO > 0. && !sky) c *= mix(1., aoAt(p, geo.w), uAO);

  if (uMode != 0 && !sky) {
    float hz = 1. - exp(-max(geo.w - uHazeStart, 0.) * uHaze * 0.011);
    vec3 hc = mix(uHazeColor, vec3(0.42, 0.62, 0.92), 0.35); // far colour leans toward sky blue, not white
    c = mix(c, hc * uExposure, hz * 0.8);
  }
  vec3 s = toSrgb(aces(c));

  if (uMode != 0) {
    float l = luma(s);
    // cool, slightly lifted shadows; warm lights
    float sh = 1. - smoothstep(0.12, 0.55, l);
    s = mix(s, s * vec3(0.78, 0.9, 1.12) + vec3(0.0, 0.015, 0.05), sh * uTint);
    s = mix(s, s * vec3(1.06, 1.02, 0.94), smoothstep(0.5, 0.9, l) * uTint * 0.6);
    if (uMode == 1) { // painted tonal grouping: gently pull values toward flat bands
      float lb = luma(s) * 5.;
      float q = (floor(lb) + smoothstep(0.3, 0.7, fract(lb))) / 5.;
      s *= mix(1., q / max(luma(s), 1e-3), 0.3);
    }
    if (uMode == 2) {
      float lb = luma(s) * uBands;
      float q = (floor(lb) + smoothstep(0.42, 0.58, fract(lb))) / uBands;
      s *= q / max(luma(s), 1e-3);
    }
    float g = luma(s);
    s = clamp(mix(vec3(g), s, uSat), 0., 1.);
  }

  vec3 ink = (uMode == 2) ? vec3(0.07, 0.06, 0.09) : s * 0.32 + vec3(0.015, 0.02, 0.05);
  if (uOut == 1) { outColor = vec4(uMode == 2 ? vec3(0.07, 0.06, 0.09) : vec3(0.05, 0.05, 0.08), clamp(ln, 0., 1.)); return; }
  if (uMode == 1) { vec2 q = uv - 0.5; s *= 1. - 0.28 * smoothstep(0.35, 0.85, length(q * vec2(1.0, 0.9))); }
  outColor = vec4(mix(s, ink, clamp(ln, 0., 1.)), 1.);
}`;

export function makeComposite(renderer) {
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */`
      in vec3 position;
      void main(){ gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: frag,
    uniforms: {
      tColor: { value: null }, tGeo: { value: null }, tId: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) }, uOut: { value: 0 }, uMode: { value: 1 },
      uExposure: { value: 1 }, uSat: { value: 1 }, uTint: { value: 0.5 }, uHaze: { value: 0.5 }, uBands: { value: 3 },
      uBloom: { value: 0 }, uAO: { value: 0 }, uHazeStart: { value: 40 }, uFocal: { value: 1000 }, uLineStrength: { value: 0.8 }, uLineWidth: { value: 1.4 }, uCrease: { value: 0.35 }, uDepth: { value: 0.04 },
      uHazeColor: { value: new THREE.Color('#c8dcec') },
    },
    depthTest: false, depthWrite: false,
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.Camera();
  return { mat, scene, cam };
}
