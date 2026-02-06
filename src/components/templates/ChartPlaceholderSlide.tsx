import type { ChartPlaceholderSlideData, TemplateProps } from "@/lib/types";

export const ChartPlaceholderSlide: React.FC<
  TemplateProps<ChartPlaceholderSlideData>
> = ({ slide, imageBase }) => (
  <section>
    <h2>{slide.title}</h2>
    <img
      src={`${imageBase}/${slide.image}`}
      alt={slide.caption ?? slide.title}
      style={{ maxHeight: "60vh", margin: "0 auto" }}
    />
    {slide.caption && <p><small>{slide.caption}</small></p>}
  </section>
);
