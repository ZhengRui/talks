import type { VideoSlideData, TemplateProps } from "@/lib/types";

export const VideoSlide: React.FC<TemplateProps<VideoSlideData>> = ({
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
      <video
        className="anim-fade-in"
        controls
        style={{
          maxWidth: '1400px',
          width: '100%',
          maxHeight: '70vh',
          borderRadius: 'var(--sl-radius)',
          boxShadow: 'var(--sl-shadow)',
          '--delay': '200ms',
        } as React.CSSProperties}
      >
        <source src={slide.src} />
      </video>
    </div>
  </section>
);
