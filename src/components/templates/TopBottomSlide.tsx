import type { TopBottomSlideData, TemplateProps } from "@/lib/types";

export const TopBottomSlide: React.FC<TemplateProps<TopBottomSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <div style={{ display: "flex", flexDirection: "column", gap: "0px", width: "100%", flex: 1 }}>
      <div
        className="sl-card anim-fade-up"
        style={{ flex: 1, '--delay': '200ms' } as React.CSSProperties}
      >
        <p>{slide.top}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
        <div className="sl-accent-line-wide anim-fade-up" style={{ '--delay': '300ms' } as React.CSSProperties} />
      </div>
      <div
        className="sl-card anim-fade-up"
        style={{ flex: 1, '--delay': '400ms' } as React.CSSProperties}
      >
        <p>{slide.bottom}</p>
      </div>
    </div>
  </section>
);
