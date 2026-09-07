export const MATCAP_PRESETS = [
  // 1. Classic Studio & Sculpting MatCaps
  { id: 'clay_studio', name: 'Clay Studio', file: 'clay_studio.jpeg', group: 'Clay & Matte' },
  { id: 'clay_brown', name: 'Clay Brown', file: 'clay_brown.jpeg', group: 'Clay & Matte' },
  { id: 'clay_muddy', name: 'Clay Muddy', file: 'clay_muddy.jpeg', group: 'Clay & Matte' },
  { id: 'basic_1', name: 'Basic 1', file: 'basic_1.jpg', group: 'Studio & Basic' },
  { id: 'basic_2', name: 'Basic 2', file: 'basic_2.jpg', group: 'Studio & Basic' },
  { id: 'basic_dark', name: 'Basic Dark', file: 'basic_dark.jpeg', group: 'Studio & Basic' },
  { id: 'basic_side', name: 'Basic Side', file: 'basic_side.jpeg', group: 'Studio & Basic' },
  { id: 'ceramic_dark', name: 'Ceramic Dark', file: 'ceramic_dark.jpeg', group: 'Ceramic & Resin' },
  { id: 'ceramic_lightbulb', name: 'Ceramic Lightbulb', file: 'ceramic_lightbulb.jpeg', group: 'Ceramic & Resin' },
  { id: 'resin', name: 'Resin', file: 'resin.jpeg', group: 'Ceramic & Resin' },
  { id: 'jade', name: 'Jade Crystal', file: 'jade.jpeg', group: 'Gems & Organics' },
  { id: 'pearl', name: 'Pearl Luster', file: 'pearl.jpeg', group: 'Gems & Organics' },
  { id: 'skin', name: 'Subsurface Skin', file: 'skin.jpeg', group: 'Gems & Organics' },
  { id: 'toon', name: 'Toon Shading', file: 'toon.jpeg', group: 'Toon' },

  // 2. Metallic & Reflection Check MatCaps
  { id: 'metal_shiny', name: 'Metal Shiny Chrome', file: 'metal_shiny.jpeg', group: 'Metals' },
  { id: 'metal_anisotropic', name: 'Metal Anisotropic', file: 'metal_anisotropic.jpeg', group: 'Metals' },
  { id: 'metal_carpaint', name: 'Metal Car Paint', file: 'metal_carpaint.jpeg', group: 'Metals' },
  { id: 'metal_lead', name: 'Metal Lead Dark', file: 'metal_lead.jpeg', group: 'Metals' },
  { id: 'check_normal_y', name: 'Check Normal +Y', file: 'check_normal+y.jpeg', group: 'Analysis' },
  { id: 'check_rim_dark', name: 'Check Rim Dark', file: 'check_rim_dark.jpeg', group: 'Analysis' },
  { id: 'check_rim_light', name: 'Check Rim Light', file: 'check_rim_light.jpeg', group: 'Analysis' },
  { id: 'reflection_check_h', name: 'Reflection Horizontal', file: 'reflection_check_horizontal.jpeg', group: 'Analysis' },
  { id: 'reflection_check_v', name: 'Reflection Vertical', file: 'reflection_check_vertical.jpeg', group: 'Analysis' },

  // 3. Blobmixer Stylized Art MatCaps
  { id: 'blobmixer_cosmic_fusion', name: 'Cosmic Fusion', file: '06_cosmic-fusion.c57d060d2ead19c63024.png', group: 'Blobmixer' },
  { id: 'blobmixer_deep_ocean', name: 'Deep Ocean', file: '07_deep-ocean.4d28da9d4d6affe2720a.png', group: 'Blobmixer' },
  { id: 'blobmixer_synthwave', name: 'Synthwave Chrome', file: '18_synthwave.4cd0536bbe9ac1a4d74e.png', group: 'Blobmixer' },
  { id: 'blobmixer_iridescent', name: 'Iridescent Oil', file: '15_iridescent.5ca76e71bfac053ac80f.png', group: 'Blobmixer' },
  { id: 'blobmixer_foil', name: 'Holographic Foil', file: '11_foil.e5e53d38ad69f795876c.png', group: 'Blobmixer' },
  { id: 'blobmixer_hollogram', name: 'Hologram Matrix', file: '13_hollogram.b58175f231f43fd02700.png', group: 'Blobmixer' },
  { id: 'blobmixer_imaginarium', name: 'Imaginarium Prismatic', file: '14_imaginarium.12a79d03b7fe54603367.png', group: 'Blobmixer' },
  { id: 'blobmixer_sirens', name: 'Sirens Neon Magenta', file: '17_sirens.d6898ed7f2f00009db64.png', group: 'Blobmixer' },
  { id: 'blobmixer_lucky_day', name: 'Lucky Day Clover', file: '08_lucky-day.417fad6f0e628f2c7b88.png', group: 'Blobmixer' },
  { id: 'blobmixer_sunset_vibes', name: 'Sunset Vibes', file: '09_sunset-vibes.059f54a69dc6a4d1bd1a.png', group: 'Blobmixer' },
  { id: 'blobmixer_primary', name: 'Gradient Primary', file: '02_gradient-primary-variation.b581b4bf70c233adc942.png', group: 'Blobmixer' },
  { id: 'blobmixer_secondary', name: 'Gradient Secondary', file: '03_gradient-secondary.1d6af076d5b5997e8bb1.png', group: 'Blobmixer' },
  { id: 'blobmixer_sunset_coral', name: 'Sunset Coral Alert', file: '04_gradient-error.7f52eea76d121e496b7d.png', group: 'Blobmixer' },
  { id: 'blobmixer_solar_flare', name: 'Solar Flare Amber', file: '05_gradient-alert.f5301ac20087c7fedfdf.png', group: 'Blobmixer' }
].map(p => ({
  ...p,
  url: `/assets/matcaps/${p.file}`
}));
