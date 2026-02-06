import type { FullImageSlideData, TemplateProps } from "@/lib/types";

export const FullImageSlide: React.FC<TemplateProps<FullImageSlideData>> = ({
  slide,
  imageBase,
}) => {
  const imgSrc = `${imageBase}/${slide.image}`;
  const overlay = slide.overlay ?? "dark";

  const textColor =
    overlay === "light" ? "var(--sl-heading)" : "#fff";
  const textShadow =
    overlay === "light"
      ? "0 1px 4px rgba(255,255,255,0.6)"
      : "0 2px 12px rgba(0,0,0,0.7)";

  return (
    <section
      className={slide.animation === "none" ? "anim-none" : undefined}
      style={{
        backgroundImage: `url(${imgSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: 0,
      }}
    >
      <div
        className={`sl-overlay ${overlay === "light" ? "sl-overlay-light" : "sl-overlay-dark"}`}
      />
      <div className="sl-content-over" style={{ gap: "24px" }}>
        {slide.title && (
          <h2
            className="anim-fade-up"
            style={{
              color: textColor,
              textShadow,
              fontSize: "64px",
              "--delay": "200ms",
            } as React.CSSProperties}
          >
            {slide.title}
          </h2>
        )}
        {slide.body && (
          <p
            className="anim-fade-up"
            style={{
              color: textColor,
              textShadow,
              fontSize: "30px",
              maxWidth: "1200px",
              textAlign: "center",
              lineHeight: 1.6,
              "--delay": "400ms",
            } as React.CSSProperties}
          >
            {slide.body}
          </p>
        )}
      </div>
    </section>
  );
};
