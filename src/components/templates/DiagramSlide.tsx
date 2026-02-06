import type { DiagramSlideData, TemplateProps } from "@/lib/types";

export const DiagramSlide: React.FC<TemplateProps<DiagramSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <img
      src={`${imageBase}/${slide.image}`}
      alt={slide.caption ?? slide.title ?? "Diagram"}
      style={{ maxHeight: "60vh", margin: "0 auto" }}
    />
    {slide.caption && <p><small>{slide.caption}</small></p>}
  </section>
);
