/** Google Fonts URL for all project fonts, used by headless render HTML. */
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@100..900",
    "family=Playfair+Display:ital,wght@0,400..900;1,400..900",
    "family=JetBrains+Mono:wght@100..800",
    "family=Archivo+Black",
    "family=Space+Grotesk:wght@300..700",
    "family=Manrope:wght@200..800",
    "family=Syne:wght@400..800",
    "family=Space+Mono:wght@400;700",
    "family=Cormorant:wght@300..700",
    "family=IBM+Plex+Sans:wght@300;400;500;600",
    "family=Bodoni+Moda:ital,wght@0,400..900;1,400..900",
    "family=DM+Sans:wght@100..900",
    "family=Plus+Jakarta+Sans:wght@200..800",
    "family=Outfit:wght@100..900",
    "family=Fraunces:ital,wght@0,100..900;1,100..900",
    "family=Work+Sans:wght@100..900",
    "family=Archivo:wght@100..900",
    "family=Nunito:wght@200..1000",
    "family=Cormorant+Garamond:wght@300;400;600;700",
    "family=Source+Serif+4:wght@200..900",
    "family=Staatliches",
    "family=Figtree:wght@300..900",
    "family=Oswald:wght@200..700",
  ].join("&") +
  "&display=swap";

/**
 * CSS custom property -> font family mapping.
 * This mirrors the variables produced by next/font so headless render HTML can
 * resolve theme font variables without importing the app shell.
 */
export const FONT_FAMILY_VARS: Record<string, string> = {
  "--font-inter": "'Inter', system-ui, sans-serif",
  "--font-playfair": "'Playfair Display', serif",
  "--font-jetbrains": "'JetBrains Mono', monospace",
  "--font-archivo-black": "'Archivo Black', sans-serif",
  "--font-space-grotesk": "'Space Grotesk', sans-serif",
  "--font-manrope": "'Manrope', sans-serif",
  "--font-syne": "'Syne', sans-serif",
  "--font-space-mono": "'Space Mono', monospace",
  "--font-cormorant": "'Cormorant', serif",
  "--font-ibm-plex-sans": "'IBM Plex Sans', sans-serif",
  "--font-bodoni-moda": "'Bodoni Moda', serif",
  "--font-dm-sans": "'DM Sans', sans-serif",
  "--font-plus-jakarta-sans": "'Plus Jakarta Sans', sans-serif",
  "--font-outfit": "'Outfit', sans-serif",
  "--font-fraunces": "'Fraunces', serif",
  "--font-work-sans": "'Work Sans', sans-serif",
  "--font-archivo": "'Archivo', sans-serif",
  "--font-nunito": "'Nunito', sans-serif",
  "--font-cormorant-garamond": "'Cormorant Garamond', serif",
  "--font-source-serif-4": "'Source Serif 4', serif",
  "--font-staatliches": "'Staatliches', sans-serif",
  "--font-figtree": "'Figtree', sans-serif",
  "--font-oswald": "'Oswald', sans-serif",
};
