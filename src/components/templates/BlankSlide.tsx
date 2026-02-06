import type { BlankSlideData, TemplateProps } from "@/lib/types";

export const BlankSlide: React.FC<TemplateProps<BlankSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section
    style={
      slide.image
        ? {
            backgroundImage: `url(${imageBase}/${slide.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { background: 'var(--sl-bg)' }
    }
  />
);
