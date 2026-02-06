import type { ImageComparisonSlideData, TemplateProps } from "@/lib/types";

export const ImageComparisonSlide: React.FC<
  TemplateProps<ImageComparisonSlideData>
> = ({ slide, imageBase }) => {
  return (
    <section className={slide.animation === "none" ? "anim-none" : undefined}>
      <div className="sl-section">
        {slide.title && (
          <div
            className="anim-fade-up"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <h2 style={{ color: "var(--sl-heading)" }}>{slide.title}</h2>
            <div className="sl-accent-line" />
          </div>
        )}
        <div className="sl-flex-row" style={{ justifyContent: "center" }}>
          <div
            className="sl-card anim-slide-left"
            style={{
              flex: 1,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              "--delay": "200ms",
            } as React.CSSProperties}
          >
            <img
              src={`${imageBase}/${slide.before.image}`}
              alt={slide.before.label ?? "Before"}
              className="sl-img-rounded"
              style={{ width: "100%", height: "auto" }}
            />
            {slide.before.label && (
              <p
                style={{
                  color: "var(--sl-text)",
                  fontWeight: 600,
                  fontSize: "24px",
                  margin: 0,
                }}
              >
                {slide.before.label}
              </p>
            )}
          </div>
          <div
            className="sl-card anim-slide-right"
            style={{
              flex: 1,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              "--delay": "200ms",
            } as React.CSSProperties}
          >
            <img
              src={`${imageBase}/${slide.after.image}`}
              alt={slide.after.label ?? "After"}
              className="sl-img-rounded"
              style={{ width: "100%", height: "auto" }}
            />
            {slide.after.label && (
              <p
                style={{
                  color: "var(--sl-text)",
                  fontWeight: 600,
                  fontSize: "24px",
                  margin: 0,
                }}
              >
                {slide.after.label}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
