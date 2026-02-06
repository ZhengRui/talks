import type { HighlightBoxSlideData, TemplateProps } from "@/lib/types";

export const HighlightBoxSlide: React.FC<
  TemplateProps<HighlightBoxSlideData>
> = ({ slide }) => {
  const variant = slide.variant ?? "info";

  const variantClass =
    variant === "warning"
      ? "sl-highlight-warning"
      : variant === "success"
        ? "sl-highlight-success"
        : "sl-highlight-info";

  return (
    <section>
      <div className="sl-section">
        {slide.title && (
          <>
            <h2 className="anim-fade-up">{slide.title}</h2>
            <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
          </>
        )}
        <div
          className={`sl-highlight-box ${variantClass} anim-scale-up`}
          style={{ '--delay': '200ms' } as React.CSSProperties}
        >
          {slide.body}
        </div>
      </div>
    </section>
  );
};
