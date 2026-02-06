import type { SectionDividerSlideData, TemplateProps } from "@/lib/types";

export const SectionDividerSlide: React.FC<
  TemplateProps<SectionDividerSlideData>
> = ({ slide, imageBase }) => (
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
        }}
      >
        {slide.title}
      </h1>
      <div className="sl-accent-line-wide anim-fade-up" style={{ "--delay": "150ms" } as React.CSSProperties} />
      {slide.subtitle && (
        <h3
          className="sl-text-muted anim-fade-up"
          style={{
            "--delay": "300ms",
            fontWeight: 400,
            textAlign: "center",
            maxWidth: "1200px",
          } as React.CSSProperties}
        >
          {slide.subtitle}
        </h3>
      )}
    </div>
  </section>
);
