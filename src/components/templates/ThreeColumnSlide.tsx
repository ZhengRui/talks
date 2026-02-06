import type { ThreeColumnSlideData, TemplateProps } from "@/lib/types";

export const ThreeColumnSlide: React.FC<TemplateProps<ThreeColumnSlideData>> = ({
  slide,
}) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2>{slide.title}</h2>
        <div className="sl-accent-line" />
      </div>
    )}
    <div className="sl-flex-row anim-stagger">
      {slide.columns.map((col, i) => (
        <div
          key={i}
          className="sl-card-accent"
          style={{ '--i': i, flex: 1, textAlign: "center" } as React.CSSProperties}
        >
          {col.icon && (
            <div style={{ fontSize: "48px", color: "var(--sl-accent)", marginBottom: "16px" }}>
              {col.icon}
            </div>
          )}
          {col.heading && (
            <h3 style={{ fontWeight: 700, marginBottom: "12px" }}>{col.heading}</h3>
          )}
          <p>{col.body}</p>
        </div>
      ))}
    </div>
  </section>
);
