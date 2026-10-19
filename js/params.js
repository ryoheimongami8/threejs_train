// Initial values only. Live values live in state.js (saved with the project JSON).
export const DEFAULT_PARAMS = {
  platform: { halfWidth: 3.3, height: 0.95, length: 62, zStart: 14 },
  track: { offset: 1.65, curve: 0.0011, gauge: 1.067, leftTrack: false },
  pillars: { count: 6, spacing: 9.5, z0: 2.0, x: 0.0, width: 0.44, depth: 0.32, height: 5.2 },
  roof: { height: 4.55, halfWidth: 3.9, pitch: 0.08, thickness: 0.28, beamSpacing: 1.9 },
  poles: { spacing: 18, xRight: 7.4, xLeft: -7.4, height: 7.6, z0: 0, leftZ: -3.5 },
  env: { treesLeft: 24, treesRight: 14, buildings: 10 },
  train: { show: false, cars: 2, zFront: -9, stripe: 'orange' },
  signs: { show: true, zMain: -9 },
  light: { azimuth: 35, elevation: 30, intensity: 3.2, skyPreset: 'winterNoon' },
};

export const SKY_PRESETS = {
  winterNoon: { top: '#2f7fd6', horizon: '#bcd9f0', sun: '#fff1d6', hemiSky: '#b6cbe4', hemiGround: '#a89f92', haze: '#c8dcec', cloud: '#ffffff' },
  dusk:       { top: '#31407f', horizon: '#ffb07a', sun: '#ffb35c', hemiSky: '#7c8fd0', hemiGround: '#8a5a48', haze: '#f2b8a0', cloud: '#ffd2b0' },
  morning:    { top: '#5aa6e6', horizon: '#ffe3c4', sun: '#fff0c8', hemiSky: '#a8cdf0', hemiGround: '#a89a86', haze: '#f2e2d2', cloud: '#fff6ea' },
};
