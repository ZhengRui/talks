import type { StatementSlideData, TemplateProps } from "@/lib/types";

export const StatementSlide: React.FC<TemplateProps<StatementSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    data-background-image={
      slide.image ? `${imageBase}/${slide.image}` : undefined
    }
    data-background-size={slide.image ? "cover" : undefined}
    data-background-opacity={slide.image ? "0.3" : undefined}
    data-background-color={slide.image ? "#000000" : undefined}
  >
    <h2 className="r-fit-text">{slide.statement}</h2>
    {slide.subtitle && <h3>{slide.subtitle}</h3>}
  </section>
);
