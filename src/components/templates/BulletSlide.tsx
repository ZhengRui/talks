import type { BulletSlideData, TemplateProps } from "@/lib/types";

export const BulletSlide: React.FC<TemplateProps<BulletSlideData>> = ({
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
    <h2>{slide.title}</h2>
    <ul>
      {slide.bullets.map((bullet, i) => (
        <li key={i} className="fragment fade-in">
          {bullet}
        </li>
      ))}
    </ul>
  </section>
);
