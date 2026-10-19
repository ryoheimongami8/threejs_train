// Style presets = materials + lighting + line pass + grade, switched together.
// Shared geometry and camera, so photo matching is done once for both.
export const STYLE_PRESETS = {
  painterly: {
    mode: 'painterly', exposure: 1.0, saturation: 1.12, shadowTint: 0.3, haze: 0.5, hazeStart: 40, bands: 3, ao: 0.6,
    lineStrength: 0.35, lineWidth: 1.2, creaseThr: 0.45, depthThr: 0.05, bloom: 0.35,
  },
  toon: {
    mode: 'toon', exposure: 1.0, saturation: 1.05, shadowTint: 0.35, haze: 0.35, hazeStart: 40, bands: 3, ao: 0.35,
    lineStrength: 0.95, lineWidth: 1.6, creaseThr: 0.32, depthThr: 0.035, bloom: 0,
  },
  clay: {
    mode: 'clay', exposure: 1.0, saturation: 1.0, shadowTint: 0, haze: 0.0, bands: 3, ao: 0,
    lineStrength: 0, lineWidth: 1, creaseThr: 0.4, depthThr: 0.05, bloom: 0,
  },
};
export const MODE_INDEX = { clay: 0, painterly: 1, toon: 2 };
