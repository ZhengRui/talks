import type { ComparisonSlideData, TemplateProps } from "@/lib/types";

export const ComparisonSlide: React.FC<TemplateProps<ComparisonSlideData>> = ({
  slide,
}) => (
  <section>
    <div className="sl-section">
      {slide.title && (
        <>
          <h2 className="anim-fade-up">{slide.title}</h2>
          <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
        </>
      )}
      <div className="sl-grid-2">
        <div
          className="sl-card anim-slide-left"
          style={{ borderTop: '3px solid #22c55e', '--delay': '200ms' } as React.CSSProperties}
        >
          <h3 style={{ marginBottom: '0.5em' }}>{slide.left.heading}</h3>
          <ul style={{ paddingLeft: '1.2em' }}>
            {slide.left.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div
          className="sl-card anim-slide-right"
          style={{ borderTop: '3px solid #ef4444', '--delay': '200ms' } as React.CSSProperties}
        >
          <h3 style={{ marginBottom: '0.5em' }}>{slide.right.heading}</h3>
          <ul style={{ paddingLeft: '1.2em' }}>
            {slide.right.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);
