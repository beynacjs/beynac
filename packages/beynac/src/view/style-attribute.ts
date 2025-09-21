// No-unit CSS properties based on React's implementation
// Source: https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/shared/isUnitlessNumber.js
const noUnitProperties = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "boxFlex",
  "boxFlexGroup",
  "boxOrdinalGroup",
  "columnCount",
  "columns",
  "flex",
  "flexGrow",
  "flexPositive",
  "flexShrink",
  "flexNegative",
  "flexOrder",
  "gridArea",
  "gridRow",
  "gridRowEnd",
  "gridRowSpan",
  "gridRowStart",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnSpan",
  "gridColumnStart",
  "fontWeight",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
  // SVG-related properties
  "fillOpacity",
  "floodOpacity",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
]);

// Add vendor prefixed versions of no-unit properties
const prefixes = ["Webkit", "Ms", "Moz", "O"];
const prefixedNoUnitProperties = new Set(noUnitProperties);

// Generate vendor-prefixed versions
for (const prop of noUnitProperties) {
  for (const prefix of prefixes) {
    prefixedNoUnitProperties.add(
      prefix + prop[0].toUpperCase() + prop.substring(1)
    );
  }
}

/**
 * Converts a style object to a CSS string.
 * Handles camelCase to kebab-case conversion and adds px units where appropriate.
 * Based on React's style handling implementation.
 */
export const styleObjectToString = (style: object): string => {
  let result = "";
  for (const [k, v] of Object.entries(style)) {
    if (v == null) continue;

    // Convert camelCase to kebab-case, except for CSS variables (starting with --)
    const key =
      k[0] === "-" || !/[A-Z]/.test(k)
        ? k // CSS variable or already kebab-case
        : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`); // Convert camelCase to kebab-case

    // Convert numbers to px for properties that need units
    const value =
      typeof v === "number"
        ? prefixedNoUnitProperties.has(k)
          ? `${v}`
          : `${v}px`
        : String(v);

    if (result) result += ";";
    result += `${key}:${value}`;
  }
  return result;
};
