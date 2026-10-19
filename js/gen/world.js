import * as THREE from 'three';
import { resetMaterials } from '../materials.js';
import { buildPlatform } from './platform.js';
import { buildTrack } from './track.js';
import { buildPillars } from './pillars.js';
import { buildRoof } from './roof.js';
import { buildFixtures } from './fixtures.js';
import { buildPoles } from './poles.js';
import { buildEnv } from './env.js';
import { buildTrain } from './train.js';
import { buildSigns } from './signs.js';
import { buildTrackside } from './trackside.js';
import { buildSky, sunDirection } from './sky.js';
import { SKY_PRESETS } from '../params.js';

/** Build the whole scene from state. Pure function of (params, seeds, overrides, style). */
export function buildWorld(state) {
  resetMaterials();
  const group = new THREE.Group();
  const ctx = { group, seeds: state.seeds, P: state.params, overrides: state.overrides, style: state.style };

  const platform = buildPlatform(ctx);
  buildTrack(ctx);
  const pillars = buildPillars(ctx);
  const roof = buildRoof(ctx, pillars);
  buildFixtures(ctx, pillars, roof);
  buildSigns(ctx, roof);
  buildTrain(ctx);
  buildPoles(ctx);
  buildEnv(ctx);
  buildTrackside(ctx);
  const sky = buildSky(ctx);

  // sun with a shadow frustum fitted to the visible stretch of platform
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.target.position.set(0, 0, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 300;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.75);
  // warm bounce from the sunlit ground into the shaded underside (no shadows)
  const bounce = new THREE.DirectionalLight(0xffffff, 0.4);
  group.add(sun, sun.target, hemi, bounce);

  const world = { group, pillars, roof, platform, lights: { sun, hemi, bounce }, skyMat: sky.mat };
  updateLighting(world, state.params.light);
  return world;
}

/** Cheap: light/sky changes never rebuild geometry. */
export function updateLighting(world, L) {
  const pre = SKY_PRESETS[L.skyPreset] ?? SKY_PRESETS.winterNoon;
  const dir = sunDirection(L);
  const { sun, hemi, bounce } = world.lights;
  sun.color.set(pre.sun); sun.intensity = L.intensity;
  sun.position.copy(dir).multiplyScalar(120).add(new THREE.Vector3(0, 0, -20));
  hemi.color.set(pre.hemiSky); hemi.groundColor.set(pre.hemiGround);
  bounce.color.set(pre.hemiGround).lerp(new THREE.Color('#fff0dc'), 0.7);
  bounce.position.set(-dir.x * 30, -20, -dir.z * 30);
  const u = world.skyMat.uniforms;
  u.uTop.value.set(pre.top); u.uHorizon.value.set(pre.horizon); u.uSun.value.set(pre.sun); u.uCloud.value.set(pre.cloud);
  u.uSunDir.value.copy(dir);
  world.sky = pre; world.sunDir = dir;
}
