import type { CodeSlideData, TemplateProps } from "@/lib/types";

export const CodeSlide: React.FC<TemplateProps<CodeSlideData>> = ({
  slide,
}) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <div
      className="sl-code-block anim-fade-in"
      style={{ '--delay': '200ms' } as React.CSSProperties}
    >
      {slide.language && (
        <span className="sl-code-label">{slide.language}</span>
      )}
      <code
        className={slide.language ? `language-${slide.language}` : undefined}
      >
        {slide.code}
      </code>
    </div>
  </section>
);
