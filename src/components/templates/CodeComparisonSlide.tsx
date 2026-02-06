import type { CodeComparisonSlideData, TemplateProps } from "@/lib/types";

export const CodeComparisonSlide: React.FC<
  TemplateProps<CodeComparisonSlideData>
> = ({ slide }) => (
  <section data-background-color="#1a1a2e">
    {slide.title && <h2>{slide.title}</h2>}
    <div style={{ display: "flex", gap: "1rem" }}>
      <div style={{ flex: 1 }}>
        {slide.before.label && (
          <h4 style={{ textAlign: "center" }}>{slide.before.label}</h4>
        )}
        <pre style={{ textAlign: "left" }}>
          <code
            className={
              slide.before.language
                ? `language-${slide.before.language}`
                : undefined
            }
            style={{ fontFamily: "monospace" }}
          >
            {slide.before.code}
          </code>
        </pre>
      </div>
      <div style={{ flex: 1 }}>
        {slide.after.label && (
          <h4 style={{ textAlign: "center" }}>{slide.after.label}</h4>
        )}
        <pre style={{ textAlign: "left" }}>
          <code
            className={
              slide.after.language
                ? `language-${slide.after.language}`
                : undefined
            }
            style={{ fontFamily: "monospace" }}
          >
            {slide.after.code}
          </code>
        </pre>
      </div>
    </div>
  </section>
);
