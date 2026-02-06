import type { BulletSlideData, TemplateProps } from "@/lib/types";

export const BulletSlide: React.FC<TemplateProps<BulletSlideData>> = ({
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
    <div className="sl-content-over sl-section-left">
      <div>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div
          className="sl-accent-line anim-fade-up"
          style={{ "--delay": "100ms", marginTop: "16px" } as React.CSSProperties}
        />
      </div>
      <div
        className="anim-stagger"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%",
        }}
      >
        {slide.bullets.map((bullet, i) => (
          <div
            key={i}
            style={{
              "--i": i,
              borderLeft: "3px solid var(--sl-accent)",
              padding: "16px 24px",
              background: "var(--sl-bg-secondary)",
              borderRadius: "var(--sl-radius-sm)",
              fontSize: "28px",
              lineHeight: 1.6,
              color: "var(--sl-text)",
            } as React.CSSProperties}
          >
            {bullet}
          </div>
        ))}
      </div>
    </div>
  </section>
);
