import type { ImageCaptionSlideData, TemplateProps } from "@/lib/types";

export const ImageCaptionSlide: React.FC<
  TemplateProps<ImageCaptionSlideData>
> = ({ slide, imageBase }) => {
  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <figure style={{ margin: 0, textAlign: "center" }}>
        <img
          src={`${imageBase}/${slide.image}`}
          alt={slide.caption}
          style={{ maxWidth: "100%", height: "auto" }}
        />
        <figcaption>{slide.caption}</figcaption>
      </figure>
    </section>
  );
};
