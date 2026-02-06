import type { IframeSlideData, TemplateProps } from "@/lib/types";

export const IframeSlide: React.FC<TemplateProps<IframeSlideData>> = ({
  slide,
}) => (
  <section>
    <div className="sl-section" style={{ height: '100%' }}>
      {slide.title && (
        <>
          <h2 className="anim-fade-up">{slide.title}</h2>
          <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
        </>
      )}
      <div
        className="anim-fade-in"
        style={{
          width: '100%',
          flex: 1,
          borderRadius: 'var(--sl-radius)',
          boxShadow: 'var(--sl-shadow)',
          overflow: 'hidden',
          '--delay': '200ms',
        } as React.CSSProperties}
      >
        <iframe
          src={slide.src}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  </section>
);
