import type { DefinitionSlideData, TemplateProps } from "@/lib/types";

export const DefinitionSlide: React.FC<TemplateProps<DefinitionSlideData>> = ({
  slide,
}) => (
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
          gap: "0px",
          width: "100%",
        }}
      >
        {slide.definitions.map((def, i) => (
          <div
            key={i}
            style={{
              "--i": i,
              padding: "24px 0",
              borderBottom: "1px solid var(--sl-border)",
            } as React.CSSProperties}
          >
            <dt
              style={{
                fontSize: "30px",
                fontWeight: 700,
                color: "var(--sl-accent)",
                marginBottom: "8px",
              }}
            >
              {def.term}
            </dt>
            <dd
              style={{
                fontSize: "26px",
                lineHeight: 1.6,
                color: "var(--sl-text)",
                margin: 0,
              }}
            >
              {def.description}
            </dd>
          </div>
        ))}
      </div>
    </div>
  </section>
);
