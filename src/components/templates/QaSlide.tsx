import type { QaSlideData, TemplateProps } from "@/lib/types";

export const QaSlide: React.FC<TemplateProps<QaSlideData>> = ({ slide }) => (
  <section>
    <h2>{slide.question}</h2>
    <p className="fragment fade-in" style={{ marginTop: "1em", fontSize: "1.2em" }}>
      {slide.answer}
    </p>
  </section>
);
