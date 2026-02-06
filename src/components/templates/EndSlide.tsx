import type { EndSlideData, TemplateProps } from "@/lib/types";

export const EndSlide: React.FC<TemplateProps<EndSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    className={slide.animation === 'none' ? 'anim-none' : undefined}
    style={{
      background: slide.image ? undefined : 'var(--sl-bg)',
      ...(slide.image
        ? {
            backgroundImage: `url(${imageBase}/${slide.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {}),
      position: 'relative',
    }}
  >
    {slide.image && <div className="sl-overlay sl-overlay-dark" />}
    <div className="sl-content-over">
      <div className="sl-section">
        <h1 className="fit-text anim-fade-up">{slide.title ?? "Thank You"}</h1>
        <div className="sl-accent-line-wide anim-fade-up" style={{ '--delay': '200ms' } as React.CSSProperties} />
        {slide.subtitle && (
          <p
            className="sl-text-muted anim-fade-up"
            style={{ fontSize: '36px', '--delay': '400ms' } as React.CSSProperties}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    </div>
  </section>
);
