import type { AgendaSlideData, TemplateProps } from "@/lib/types";

export const AgendaSlide: React.FC<TemplateProps<AgendaSlideData>> = ({
  slide,
}) => (
  <section>
    <h2>{slide.title}</h2>
    <ul>
      {slide.items.map((item, i) => (
        <li
          key={i}
          className={
            slide.activeIndex !== undefined
              ? i === slide.activeIndex
                ? "font-bold"
                : "opacity-50"
              : undefined
          }
        >
          {item}
        </li>
      ))}
    </ul>
  </section>
);
