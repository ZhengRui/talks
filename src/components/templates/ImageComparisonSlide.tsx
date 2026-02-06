import type { ImageComparisonSlideData, TemplateProps } from "@/lib/types";

export const ImageComparisonSlide: React.FC<
  TemplateProps<ImageComparisonSlideData>
> = ({ slide, imageBase }) => {
  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div style={{ display: "flex", gap: "2rem", justifyContent: "center" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <img
            src={`${imageBase}/${slide.before.image}`}
            alt={slide.before.label ?? "Before"}
            style={{ width: "100%", height: "auto" }}
          />
          {slide.before.label && <p>{slide.before.label}</p>}
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <img
            src={`${imageBase}/${slide.after.image}`}
            alt={slide.after.label ?? "After"}
            style={{ width: "100%", height: "auto" }}
          />
          {slide.after.label && <p>{slide.after.label}</p>}
        </div>
      </div>
    </section>
  );
};
