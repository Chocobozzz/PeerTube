export const PluginType = {
  PLUGIN: 1,
  THEME: 2
} as const

export type PluginType_Type = typeof PluginType[keyof typeof PluginType]
