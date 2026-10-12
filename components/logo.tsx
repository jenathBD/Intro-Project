/** BD's logo: sort ordmærke på lys flade, hvidt i mørk tilstand. Højde 24–32 px (bd-style.md). */
export function Logo() {
  return (
    <picture>
      <source srcSet="/brand/bd-logo-white.web.svg" media="(prefers-color-scheme: dark)" />
      <img className="bd-logo" src="/brand/bd-logo.web.svg" alt="Better Developers" />
    </picture>
  );
}
