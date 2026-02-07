import type { ProfileSlideData, TemplateProps } from "@/lib/types";

export const ProfileSlide: React.FC<TemplateProps<ProfileSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section>
    <div className="sl-section">
      {slide.image && (
        <img
          className="sl-img-circle anim-scale-up"
          src={`${imageBase}/${slide.image}`}
          alt={slide.name}
          style={{ width: '200px', height: '200px' }}
        />
      )}
      <h2 className="anim-fade-up" style={{ '--delay': '200ms' } as React.CSSProperties}>
        {slide.name}
      </h2>
      {slide.title && (
        <p className="sl-text-accent anim-fade-up" style={{ fontSize: '32px', '--delay': '300ms' } as React.CSSProperties}>
          {slide.title}
        </p>
      )}
      <div className="sl-accent-line anim-fade-up" style={{ '--delay': '350ms' } as React.CSSProperties} />
      {slide.bio && (
        <p
          className="sl-text-muted anim-fade-up"
          style={{ maxWidth: '700px', textAlign: 'center', '--delay': '300ms' } as React.CSSProperties}
        >
          {slide.bio}
        </p>
      )}
    </div>
  </section>
);
