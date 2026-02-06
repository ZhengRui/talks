import type { QuoteSlideData, TemplateProps } from "@/lib/types";

export const QuoteSlide: React.FC<TemplateProps<QuoteSlideData>> = ({
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
      <div
        className="sl-quote-mark anim-fade-in"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      >
        {"\u201C"}
      </div>
      <blockquote
        className="anim-scale-up"
        style={{
          "--delay": "150ms",
          fontStyle: "italic",
          fontSize: "36px",
          lineHeight: 1.6,
          maxWidth: "1200px",
          textAlign: "center",
          color: "var(--sl-text)",
          border: "none",
          padding: 0,
          margin: 0,
        } as React.CSSProperties}
      >
        {slide.quote}
      </blockquote>
      {slide.attribution && (
        <p
          className="sl-text-muted anim-fade-up"
          style={{
            "--delay": "400ms",
            fontSize: "24px",
          } as React.CSSProperties}
        >
          &mdash; {slide.attribution}
        </p>
      )}
    </div>
  </section>
);
