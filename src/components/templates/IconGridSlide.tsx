import type { IconGridSlideData, TemplateProps } from "@/lib/types";

export const IconGridSlide: React.FC<TemplateProps<IconGridSlideData>> = ({
  slide,
}) => {
  const columns = slide.columns ?? 3;

  return (
    <section className={slide.animation === "none" ? "anim-none" : undefined}>
      <div className="sl-section">
        {slide.title && (
          <>
            <h2 className="anim-fade-up">{slide.title}</h2>
            <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
          </>
        )}
        <div
          className="anim-stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '32px',
            width: '100%',
          }}
        >
          {slide.items.map((item, i) => (
            <div
              key={i}
              className="sl-card"
              style={{
                '--i': i,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                textAlign: 'center',
              } as React.CSSProperties}
            >
              <div style={{ fontSize: '64px', lineHeight: 1 }}>{item.icon}</div>
              <p style={{ fontWeight: 500 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
