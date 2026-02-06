import type { CoverSlideData, TemplateProps } from "@/lib/types";

export const CoverSlide: React.FC<TemplateProps<CoverSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    data-background-image={
      slide.image ? `${imageBase}/${slide.image}` : undefined
    }
    data-background-size="cover"
    data-background-opacity={slide.image ? "0.3" : undefined}
    data-background-color="#000000"
  >
    <h1 className="r-fit-text">{slide.title}</h1>
    {slide.subtitle && <h3>{slide.subtitle}</h3>}
    {slide.author && <p className="text-2xl">{slide.author}</p>}
  </section>
);
