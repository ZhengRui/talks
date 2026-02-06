import type { TwoColumnSlideData, TemplateProps } from "@/lib/types";

export const TwoColumnSlide: React.FC<TemplateProps<TwoColumnSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <div className="sl-flex-row">
      <div
        className="sl-card anim-slide-left"
        style={{ flex: 1, '--delay': '200ms' } as React.CSSProperties}
      >
        <p>{slide.left}</p>
      </div>
      <div
        className="sl-card anim-slide-right"
        style={{ flex: 1, '--delay': '200ms' } as React.CSSProperties}
      >
        <p>{slide.right}</p>
      </div>
    </div>
  </section>
);
