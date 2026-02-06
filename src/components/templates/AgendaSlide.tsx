import type { AgendaSlideData, TemplateProps } from "@/lib/types";

export const AgendaSlide: React.FC<TemplateProps<AgendaSlideData>> = ({
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
          gap: "12px",
          width: "100%",
        }}
      >
        {slide.items.map((item, i) => {
          const isActive =
            slide.activeIndex === undefined || i === slide.activeIndex;
          const hasActiveIndex = slide.activeIndex !== undefined;
          return (
            <div
              key={i}
              style={{
                "--i": i,
                display: "flex",
                alignItems: "center",
                padding: "18px 24px",
                borderLeft: hasActiveIndex
                  ? isActive
                    ? "3px solid var(--sl-accent)"
                    : "3px solid transparent"
                  : "3px solid var(--sl-accent)",
                opacity: hasActiveIndex ? (isActive ? 1 : 0.5) : 1,
                fontSize: "28px",
                lineHeight: 1.5,
                color: "var(--sl-text)",
                fontWeight: isActive && hasActiveIndex ? 600 : 400,
                borderRadius: "var(--sl-radius-sm)",
                background: isActive && hasActiveIndex ? "var(--sl-bg-secondary)" : "transparent",
                transition: "opacity 0.3s ease, background 0.3s ease",
              } as React.CSSProperties}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  </section>
);
