import type { ChartPlaceholderSlideData, TemplateProps } from "@/lib/types";

export const ChartPlaceholderSlide: React.FC<
  TemplateProps<ChartPlaceholderSlideData>
> = ({ slide, imageBase }) => (
  <section>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
      <h2 className="anim-fade-up">{slide.title}</h2>
      <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
    </div>
    <img
      className="sl-img-rounded anim-scale-up"
      src={`${imageBase}/${slide.image}`}
      alt={slide.caption ?? slide.title}
      style={{ maxHeight: "55vh", margin: "0 auto", display: "block", '--delay': '200ms' } as React.CSSProperties}
    />
    {slide.caption && (
      <p
        className="sl-text-muted anim-fade-up"
        style={{ marginTop: "20px", fontSize: "22px", '--delay': '400ms' } as React.CSSProperties}
      >
        {slide.caption}
      </p>
    )}
  </section>
);
