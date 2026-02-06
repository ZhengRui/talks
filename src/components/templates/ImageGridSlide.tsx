import type { ImageGridSlideData, TemplateProps } from "@/lib/types";

export const ImageGridSlide: React.FC<TemplateProps<ImageGridSlideData>> = ({
  slide,
  imageBase,
}) => {
  const columns = slide.columns ?? 2;

  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "1rem",
        }}
      >
        {slide.images.map((img, i) => (
          <figure key={i} style={{ margin: 0 }}>
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
