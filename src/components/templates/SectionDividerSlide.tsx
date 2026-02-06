import type { SectionDividerSlideData, TemplateProps } from "@/lib/types";

export const SectionDividerSlide: React.FC<
  TemplateProps<SectionDividerSlideData>
> = ({ slide, imageBase }) => (
  <section
    data-background-image={
      slide.image ? `${imageBase}/${slide.image}` : undefined
    }
    data-background-size={slide.image ? "cover" : undefined}
    data-background-opacity={slide.image ? "0.3" : undefined}
    data-background-color={slide.image ? "#000000" : undefined}
  >
    <h1 className="r-fit-text">{slide.title}</h1>
    {slide.subtitle && <h3>{slide.subtitle}</h3>}
  </section>
);
