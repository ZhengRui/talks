import type { ImageGallerySlideData, TemplateProps } from "@/lib/types";

export const ImageGallerySlide: React.FC<
  TemplateProps<ImageGallerySlideData>
> = ({ slide, imageBase }) => {
  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {slide.images.map((img, i) => (
          <figure key={i} style={{ margin: 0, flex: 1, textAlign: "center" }}>
            <img
              src={`${imageBase}/${img.src}`}
              alt={img.caption ?? ""}
              style={{ width: "100%", height: "auto" }}
            />
            {img.caption && <figcaption>{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
};
