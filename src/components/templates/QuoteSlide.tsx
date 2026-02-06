import type { QuoteSlideData, TemplateProps } from "@/lib/types";

export const QuoteSlide: React.FC<TemplateProps<QuoteSlideData>> = ({
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
    <blockquote>{slide.quote}</blockquote>
    {slide.attribution && <p>&mdash; {slide.attribution}</p>}
  </section>
);
