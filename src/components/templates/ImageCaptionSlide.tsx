import type { ImageCaptionSlideData, TemplateProps } from "@/lib/types";

export const ImageCaptionSlide: React.FC<
  TemplateProps<ImageCaptionSlideData>
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
        <figure
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <img
            className="sl-img-rounded anim-scale-up"
            src={`${imageBase}/${slide.image}`}
            alt={slide.caption}
            style={{
              maxWidth: "100%",
              maxHeight: "60vh",
              height: "auto",
              "--delay": "200ms",
            } as React.CSSProperties}
          />
          <figcaption
            className="sl-text-muted anim-fade-up"
            style={{
              textAlign: "center",
              fontSize: "24px",
              lineHeight: 1.5,
              maxWidth: "900px",
              "--delay": "400ms",
            } as React.CSSProperties}
          >
            {slide.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
