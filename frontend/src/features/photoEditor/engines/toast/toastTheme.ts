import { VENDOR_THEME } from "@/lib/vendorTheme";

/** TOAST UI Image Editor theme — seller/vendor sky blue accent */
export const toastEditorTheme = {
  "common.bi.image": "",
  "common.bisize.width": "0",
  "common.bisize.height": "0",
  "common.backgroundImage": "none",
  "common.backgroundColor": "#f8fafc",
  "common.border": "0px",

  "header.backgroundImage": "none",
  "header.backgroundColor": VENDOR_THEME.primary,
  "header.border": "0px",
  "header.display": "none",

  "loadButton.backgroundColor": VENDOR_THEME.primary,
  "loadButton.border": "0px",
  "loadButton.color": "#fff",
  "loadButton.fontFamily": "inherit",
  "loadButton.fontSize": "12px",
  "loadButton.display": "none",

  "downloadButton.backgroundColor": VENDOR_THEME.primary,
  "downloadButton.border": "0px",
  "downloadButton.color": "#fff",
  "downloadButton.fontFamily": "inherit",
  "downloadButton.fontSize": "12px",
  "downloadButton.display": "none",

  "menu.normalIcon.color": "#64748b",
  "menu.activeIcon.color": VENDOR_THEME.primary,
  "menu.disabledIcon.color": "#cbd5e1",
  "menu.hoverIcon.color": VENDOR_THEME.primaryDark,
  "menu.iconSize.width": "24px",
  "menu.iconSize.height": "24px",

  "submenu.backgroundColor": "#ffffff",
  "submenu.partition.color": "#e2e8f0",
  "submenu.normalIcon.color": "#64748b",
  "submenu.activeIcon.color": VENDOR_THEME.primary,
  "submenu.iconSize.width": "32px",
  "submenu.iconSize.height": "32px",
  "submenu.normalLabel.color": "#334155",
  "submenu.activeLabel.color": VENDOR_THEME.primary,
  "submenu.title.color": "#334155",

  "checkbox.border": "1px solid #e2e8f0",
  "checkbox.backgroundColor": "#fff",
  "checkbox.activeBorder": "1px solid " + VENDOR_THEME.primary,
  "checkbox.activeBackgroundColor": VENDOR_THEME.primary,

  "range.pointer.color": VENDOR_THEME.primary,
  "range.bar.color": "#e2e8f0",
  "range.subbar.color": VENDOR_THEME.primaryLight,

  "colorpicker.button.border": "1px solid #e2e8f0",
  "colorpicker.title.color": "#334155",
};

export const TOAST_MENU = [
  "crop",
  "flip",
  "rotate",
  "draw",
  "shape",
  "icon",
  "text",
  "mask",
  "filter",
] as const;
