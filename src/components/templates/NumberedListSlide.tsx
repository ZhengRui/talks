import type { NumberedListSlideData, TemplateProps } from "@/lib/types";

export const NumberedListSlide: React.FC<
  TemplateProps<NumberedListSlideData>
> = ({ slide }) => (
  <section>
    <h2>{slide.title}</h2>
    <ol>
      {slide.items.map((item, i) => (
        <li key={i} className="fragment fade-in">
          {item}
        </li>
      ))}
    </ol>
  </section>
);
