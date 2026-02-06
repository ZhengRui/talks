import type { StatsSlideData, TemplateProps } from "@/lib/types";

export const StatsSlide: React.FC<TemplateProps<StatsSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <div
      className="anim-counter"
      style={{
        display: "flex",
        justifyContent: "space-evenly",
        alignItems: "stretch",
        gap: "32px",
        width: "100%",
      }}
    >
      {slide.stats.map((stat, i) => (
        <div
          key={i}
          className="sl-card-accent"
          style={{
            textAlign: "center",
            flex: 1,
            '--i': i,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          } as React.CSSProperties}
        >
          <p style={{
            fontSize: "72px",
            fontWeight: 700,
            color: "var(--sl-accent)",
            margin: 0,
            lineHeight: 1.1,
          }}>
            {stat.value}
          </p>
          <p className="sl-text-muted" style={{ marginTop: "12px", fontSize: "24px" }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  </section>
);
