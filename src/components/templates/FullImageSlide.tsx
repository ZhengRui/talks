import type { FullImageSlideData, TemplateProps } from "@/lib/types";

export const FullImageSlide: React.FC<TemplateProps<FullImageSlideData>> = ({
  slide,
  imageBase,
}) => {
  const imgSrc = `${imageBase}/${slide.image}`;
  const overlay = slide.overlay ?? "dark";

  return (
    <section
      data-background-image={imgSrc}
      data-background-size="cover"
      data-background-opacity={overlay === "dark" ? "0.4" : "0.7"}
      data-background-color={overlay === "dark" ? "#000000" : "#ffffff"}
    >
      {slide.title && (
        <h2 className={overlay === "light" ? "text-black" : ""}>{slide.title}</h2>
      )}
      {slide.body && (
        <p className={overlay === "light" ? "text-black" : ""}>{slide.body}</p>
      )}
    </section>
  );
};
