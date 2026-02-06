import type { QaSlideData, TemplateProps } from "@/lib/types";

export const QaSlide: React.FC<TemplateProps<QaSlideData>> = ({ slide }) => (
  <section>
    <div className="sl-section">
      <h2 className="anim-fade-up">{slide.question}</h2>
      <div className="sl-accent-line anim-fade-up" style={{ '--delay': '200ms' } as React.CSSProperties} />
      <div
        className="sl-card anim-blur-in"
        style={{
          maxWidth: '1200px',
          width: '100%',
          '--delay': '400ms',
        } as React.CSSProperties}
      >
        <p style={{ fontWeight: 400 }}>{slide.answer}</p>
      </div>
    </div>
  </section>
);
