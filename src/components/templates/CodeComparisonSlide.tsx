import type { CodeComparisonSlideData, TemplateProps } from "@/lib/types";

export const CodeComparisonSlide: React.FC<
  TemplateProps<CodeComparisonSlideData>
> = ({ slide }) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <div style={{ display: "flex", gap: "32px", width: "100%" }}>
      <div className="anim-slide-left" style={{ flex: 1, '--delay': '200ms' } as React.CSSProperties}>
        {slide.before.label && (
          <p className="sl-text-muted" style={{ marginBottom: "12px", fontSize: "22px", textAlign: "center" }}>
            {slide.before.label}
          </p>
        )}
        <div className="sl-code-block" style={{ position: "relative" }}>
          {slide.before.language && (
            <span className="sl-code-label">{slide.before.language}</span>
          )}
          <code
            className={
              slide.before.language
                ? `language-${slide.before.language}`
                : undefined
            }
          >
            {slide.before.code}
          </code>
        </div>
      </div>
      <div className="anim-slide-right" style={{ flex: 1, '--delay': '400ms' } as React.CSSProperties}>
        {slide.after.label && (
          <p className="sl-text-muted" style={{ marginBottom: "12px", fontSize: "22px", textAlign: "center" }}>
            {slide.after.label}
          </p>
        )}
        <div className="sl-code-block" style={{ position: "relative" }}>
          {slide.after.language && (
            <span className="sl-code-label">{slide.after.language}</span>
          )}
          <code
            className={
              slide.after.language
                ? `language-${slide.after.language}`
                : undefined
            }
          >
            {slide.after.code}
          </code>
        </div>
      </div>
    </div>
  </section>
);
