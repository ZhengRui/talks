import type { CoverSlideData, TemplateProps } from "@/lib/types";

export const CoverSlide: React.FC<TemplateProps<CoverSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    className={slide.animation === "none" ? "anim-none" : undefined}
    style={{ background: "var(--sl-bg)" }}
  >
    {slide.image && (
      <>
        <img
          src={`${imageBase}/${slide.image}`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
        <div className="sl-overlay sl-overlay-dark" />
      </>
    )}
    <div className="sl-content-over sl-section">
      <h1
        className="anim-fade-up"
        style={{
          fontSize: "80px",
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "1400px",
          lineHeight: 1.1,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
          ...(slide.image ? { color: "#fff" } : {}),
        }}
      >
        {slide.title}
      </h1>
      <div className="sl-accent-line-wide anim-fade-up" style={{ "--delay": "150ms" } as React.CSSProperties} />
      {slide.subtitle && (
        <h3
          className={`${slide.image ? "" : "sl-text-muted "}anim-fade-up`}
          style={{
            "--delay": "300ms",
            fontWeight: 400,
            textAlign: "center",
            maxWidth: "1200px",
            textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            ...(slide.image ? { color: "rgba(255,255,255,0.85)" } : {}),
          } as React.CSSProperties}
        >
          {slide.subtitle}
        </h3>
      )}
      {slide.author && (
        <span
          className="sl-pill anim-fade-up"
          style={{
            "--delay": "450ms",
            ...(slide.image ? { color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.2)" } : {}),
          } as React.CSSProperties}
        >
          {slide.author}
        </span>
      )}
    </div>
  </section>
);
