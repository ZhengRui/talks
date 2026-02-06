import type { BlankSlideData, TemplateProps } from "@/lib/types";

export const BlankSlide: React.FC<TemplateProps<BlankSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    data-background-image={
      slide.image ? `${imageBase}/${slide.image}` : undefined
    }
    data-background-size={slide.image ? "cover" : undefined}
  />
);
