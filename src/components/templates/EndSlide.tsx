import type { EndSlideData, TemplateProps } from "@/lib/types";

export const EndSlide: React.FC<TemplateProps<EndSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    data-background-image={
      slide.image ? `${imageBase}/${slide.image}` : undefined
    }
    data-background-size={slide.image ? "cover" : undefined}
    data-background-opacity={slide.image ? "0.3" : undefined}
    data-background-color="#000000"
  >
    <h1 className="r-fit-text">{slide.title ?? "Thank You"}</h1>
    {slide.subtitle && <h3>{slide.subtitle}</h3>}
  </section>
);
