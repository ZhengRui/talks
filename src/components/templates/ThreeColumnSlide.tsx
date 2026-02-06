import type { ThreeColumnSlideData, TemplateProps } from "@/lib/types";

export const ThreeColumnSlide: React.FC<TemplateProps<ThreeColumnSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div className="flex gap-8">
      {slide.columns.map((col, i) => (
        <div key={i} style={{ flex: 1 }}>
          {col.icon && <div className="text-4xl mb-2">{col.icon}</div>}
          {col.heading && <h3>{col.heading}</h3>}
          <p>{col.body}</p>
        </div>
      ))}
    </div>
  </section>
);
