import type { TimelineSlideData, TemplateProps } from "@/lib/types";

export const TimelineSlide: React.FC<TemplateProps<TimelineSlideData>> = ({
  slide,
}) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2>{slide.title}</h2>
        <div className="sl-accent-line" />
      </div>
    )}
    <div className="sl-timeline anim-stagger">
      {slide.events.map((event, i) => (
        <div
          key={i}
          className="sl-timeline-item"
          style={{ '--i': i } as React.CSSProperties}
        >
          <div className="sl-timeline-dot" />
          <strong style={{ fontSize: "24px", color: "var(--sl-accent)", marginBottom: "8px" }}>
            {event.date}
          </strong>
          <p style={{ fontWeight: 700, margin: "8px 0 4px", fontSize: "24px" }}>
            {event.label}
          </p>
          {event.description && (
            <p className="sl-text-muted" style={{ fontSize: "20px" }}>
              {event.description}
            </p>
          )}
        </div>
      ))}
    </div>
  </section>
);
