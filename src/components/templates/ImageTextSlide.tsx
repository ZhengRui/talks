import type { ImageTextSlideData, TemplateProps } from "@/lib/types";

export const ImageTextSlide: React.FC<TemplateProps<ImageTextSlideData>> = ({
  slide,
  imageBase,
}) => {
  const imgSrc = `${imageBase}/${slide.image}`;
  const position = slide.imagePosition ?? "left";

  const imageCol = (
    <div
      className={position === "left" ? "anim-slide-left" : "anim-slide-right"}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        "--delay": "200ms",
      } as React.CSSProperties}
    >
      <img
        src={imgSrc}
        alt={slide.title}
        className="sl-img-rounded"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );

  const textCol = (
    <div
      className={`sl-flex-col ${position === "left" ? "anim-slide-right" : "anim-slide-left"}`}
      style={{
        flex: 1,
        justifyContent: "center",
        "--delay": "200ms",
      } as React.CSSProperties}
    >
      <div>
        <h2 style={{ color: "var(--sl-heading)", marginBottom: "16px" }}>
          {slide.title}
        </h2>
        <div className="sl-accent-line" />
      </div>
      {slide.body && (
        <p style={{ color: "var(--sl-text)", lineHeight: 1.7 }}>
          {slide.body}
        </p>
      )}
      {slide.bullets && (
        <ul
          className={slide.bullets.length > 1 ? "anim-stagger" : undefined}
          style={{
            color: "var(--sl-text)",
            paddingLeft: "1.2em",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {slide.bullets.map((bullet, i) => (
            <li
              key={i}
              style={{ "--i": i } as React.CSSProperties}
            >
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className={slide.animation === "none" ? "anim-none" : undefined}>
      <div
        className="sl-flex-row"
        style={{ height: "100%", alignItems: "stretch" }}
      >
        {position === "left" ? (
          <>
            {imageCol}
            {textCol}
          </>
        ) : (
          <>
            {textCol}
            {imageCol}
          </>
        )}
      </div>
    </section>
  );
};
