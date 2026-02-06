import type { ImageGridSlideData, TemplateProps } from "@/lib/types";

export const ImageGridSlide: React.FC<TemplateProps<ImageGridSlideData>> = ({
  slide,
  imageBase,
}) => {
  const columns = slide.columns ?? 2;

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
        <div
          className={`anim-stagger ${columns === 3 ? "sl-grid-3" : "sl-grid-2"}`}
        >
          {slide.images.map((img, i) => (
            <figure
              key={i}
              style={{
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                "--i": i,
              } as React.CSSProperties}
            >
              <img
                src={`${imageBase}/${img.src}`}
                alt={img.caption ?? ""}
                className="sl-img-rounded"
                style={{ width: "100%", height: "auto" }}
              />
              {img.caption && (
                <figcaption
                  className="sl-text-muted"
                  style={{
                    textAlign: "center",
                    fontSize: "22px",
                    lineHeight: 1.4,
                  }}
                >
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};
