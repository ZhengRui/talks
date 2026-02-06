import Image from "next/image";
import type { ImageTextSlideData, TemplateProps } from "@/lib/types";

export const ImageTextSlide: React.FC<TemplateProps<ImageTextSlideData>> = ({
  slide,
  imageBase,
}) => {
  const imgSrc = `${imageBase}/${slide.image}`;
  const position = slide.imagePosition ?? "left";

  const imageCol = (
    <div className="relative" style={{ flex: 1 }}>
      <Image
        src={imgSrc}
        alt={slide.title}
        fill
        className="object-contain"
      />
    </div>
  );

  const textCol = (
    <div className="flex flex-col justify-center" style={{ flex: 1 }}>
      <h2>{slide.title}</h2>
      {slide.body && <p>{slide.body}</p>}
      {slide.bullets && (
        <ul>
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="fragment fade-in">
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section>
      <div className="flex gap-8 items-stretch" style={{ height: "80vh" }}>
        {position === "left" ? (
          <>
            {imageCol}
            {textCol}
          </>
        ) : (
          <>
            {textCol}
            {imageCol}
          </>
        )}
      </div>
    </section>
  );
};
