// This is the default theme file
// It will be overridden by the site-settings plugin during build

export const themeColors = {
  primary: {
    "50": "#eef3ff",
    "100": "#dce6ff",
    "200": "#bcd0ff",
    "300": "#8bb1ff",
    "400": "#5989ff",
    "500": "#3e6df9",
    "600": "#0f47e4",
    "700": "#0d3ccb",
    "800": "#0935b1",
    "900": "#072c8a",
    "950": "#051c57"
  },
  secondary: {
    "50": "#f0f9ff",
    "100": "#e0f2fe",
    "200": "#bae6fd",
    "300": "#7dd3fc",
    "400": "#38bdf8",
    "500": "#0ea5e9",
    "600": "#0284c7",
    "700": "#0369a1",
    "800": "#075985",
    "900": "#0c4a6e",
    "950": "#082f49"
  },
  background: "#000000",
  text: "#ffffff"
};

export default {
  theme: {
    extend: {
      colors: themeColors
    }
  }
}; 