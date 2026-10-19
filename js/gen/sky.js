import * as THREE from 'three';
import { tag } from '../registry.js';
import { SKY_PRESETS } from '../params.js';

export function sunDirection(light) {
  const az = THREE.MathUtils.degToRad(light.azimuth), el = THREE.MathUtils.degToRad(light.elevation);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

const vert = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`;

// stylised sky: gradient + banded fbm clouds lit from the sun side
const frag = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uTop, uHorizon, uSun, uCloud;
uniform vec3 uSunDir;
uniform float uSeed, uBands;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0., 1.);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
  float sd = max(dot(d, uSunDir), 0.);
  col += uSun * (pow(sd, 6.) * 0.18 + pow(sd, 120.) * 0.9);
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.28) * 1.4 + vec2(uSeed * 3.1, uSeed * 1.7);
    float c = fbm(uv);
    float m = smoothstep(0.52, 0.66, c);
    float lit = clamp(dot(normalize(vec3(d.x, d.y + 0.6, d.z)), uSunDir) * 0.5 + 0.55, 0., 1.);
    // band the cloud shading into 2-3 flat tones (painted look)
    float bands = max(uBands, 1.);
    float tone = floor(lit * bands + 0.5) / bands;
    vec3 cc = mix(uCloud * vec3(0.72, 0.78, 0.92), uCloud, tone);
    float fade = smoothstep(0.0, 0.18, d.y);
    col = mix(col, cc, m * fade * 0.95);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky(ctx) {
  const { group, P, style } = ctx;
  const pre = SKY_PRESETS[P.light.skyPreset] ?? SKY_PRESETS.winterNoon;
  const c = (h) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: c(pre.top) }, uHorizon: { value: c(pre.horizon) }, uSun: { value: c(pre.sun) }, uCloud: { value: c(pre.cloud) },
      uSunDir: { value: sunDirection(P.light) }, uSeed: { value: ctx.seeds.props }, uBands: { value: style.mode === 'toon' ? 2 : 3 },
    },
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  tag(m, { name: 'sky', mask: 'sky', line: 'none' });
  m.userData.isSky = true;
  group.add(m);
  return { preset: pre, mat };
}
