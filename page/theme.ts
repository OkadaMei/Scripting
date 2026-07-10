import { Color, DynamicShapeStyle, LinearGradient } from "scripting"

function accentGradient(tint: Color, surface: Color): LinearGradient {
  return {
    colors: [tint, surface],
    startPoint: "topLeading",
    endPoint: "bottomTrailing",
  }
}

export const HANIME_THEME = {
  layout: {
    compact: 8,
    row: 12,
    section: 18,
    heroRadius: 24,
    cardRadius: 18,
    controlRadius: 14,
  },
  chrome: {
    appBackground: {
      light: "systemGroupedBackground",
      dark: "systemGroupedBackground",
    } as DynamicShapeStyle,
  },
  library: {
    accentCardBackground: {
      light: accentGradient("rgba(255,45,85,0.16)", "rgba(255,255,255,0.98)"),
      dark: accentGradient("rgba(255,45,85,0.28)", "rgba(38,24,31,0.98)"),
    } as DynamicShapeStyle,
    softAccentCardBackground: {
      light: accentGradient("rgba(255,45,85,0.09)", "rgba(255,255,255,0.98)"),
      dark: accentGradient("rgba(255,45,85,0.16)", "rgba(31,26,30,0.98)"),
    } as DynamicShapeStyle,
    statCardBackground: {
      light: "rgba(255,255,255,0.82)",
      dark: "rgba(255,255,255,0.11)",
    } as DynamicShapeStyle,
    actionPillBackground: {
      light: "rgba(255,255,255,0.76)",
      dark: "rgba(255,255,255,0.13)",
    } as DynamicShapeStyle,
    stateCardBackground: {
      light: "rgba(255,255,255,0.92)",
      dark: "rgba(255,255,255,0.09)",
    } as DynamicShapeStyle,
    selectedRowBackground: {
      light: "rgba(255,45,85,0.12)",
      dark: "rgba(255,45,85,0.23)",
    } as DynamicShapeStyle,
  },
}
