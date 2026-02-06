import type { NumberedListSlideData, TemplateProps } from "@/lib/types";

export const NumberedListSlide: React.FC<
  TemplateProps<NumberedListSlideData>
> = ({ slide }) => (
  <section
    className={slide.animation === "none" ? "anim-none" : undefined}
    style={{ background: "var(--sl-bg)" }}
  >
    <div className="sl-section-left">
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
          gap: "20px",
          width: "100%",
        }}
      >
        {slide.items.map((item, i) => (
          <div
            key={i}
            style={{
              "--i": i,
              display: "flex",
              alignItems: "center",
              gap: "20px",
              fontSize: "28px",
              lineHeight: 1.5,
              color: "var(--sl-text)",
            } as React.CSSProperties}
          >
            <span className="sl-badge">{i + 1}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);
