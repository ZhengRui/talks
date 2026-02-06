import type { CodeSlideData, TemplateProps } from "@/lib/types";

export const CodeSlide: React.FC<TemplateProps<CodeSlideData>> = ({
  slide,
}) => (
  <section data-background-color="#1a1a2e">
    {slide.title && <h2>{slide.title}</h2>}
    <pre style={{ textAlign: "left" }}>
      <code
        className={slide.language ? `language-${slide.language}` : undefined}
        style={{ fontFamily: "monospace" }}
      >
        {slide.code}
      </code>
    </pre>
  </section>
);
