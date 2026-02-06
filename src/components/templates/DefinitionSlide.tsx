import type { DefinitionSlideData, TemplateProps } from "@/lib/types";

export const DefinitionSlide: React.FC<TemplateProps<DefinitionSlideData>> = ({
  slide,
}) => (
  <section>
    <h2>{slide.title}</h2>
    <dl>
      {slide.definitions.map((def, i) => (
        <div key={i} className="fragment fade-in">
          <dt>{def.term}</dt>
          <dd>{def.description}</dd>
        </div>
      ))}
    </dl>
  </section>
);
