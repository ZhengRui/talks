import type { StepsSlideData, TemplateProps } from "@/lib/types";

export const StepsSlide: React.FC<TemplateProps<StepsSlideData>> = ({
  slide,
}) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    <div className="sl-section">
      {slide.title && (
        <>
          <h2 className="anim-fade-up">{slide.title}</h2>
          <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
        </>
      )}
      <div className="sl-steps anim-stagger">
        {slide.steps.map((step, i) => (
          <div key={i} style={{ '--i': i } as React.CSSProperties}>
            <div className="sl-step">
              <div className="sl-step-connector">
                <div className="sl-badge">{i + 1}</div>
                {i < slide.steps.length - 1 && <div className="sl-step-line" />}
              </div>
              <div className="sl-card" style={{ flex: 1 }}>
                <strong style={{ fontSize: '28px' }}>{step.label}</strong>
                {step.description && (
                  <p className="sl-text-muted" style={{ marginTop: '8px' }}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
