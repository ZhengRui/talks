import type { ComparisonSlideData, TemplateProps } from "@/lib/types";

export const ComparisonSlide: React.FC<TemplateProps<ComparisonSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div className="flex gap-8" style={{ marginTop: "1em" }}>
      <div style={{ flex: 1 }}>
        <h3>{slide.left.heading}</h3>
        <ul>
          {slide.left.items.map((item, i) => (
            <li key={i} className="fragment fade-in">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1 }}>
        <h3>{slide.right.heading}</h3>
        <ul>
          {slide.right.items.map((item, i) => (
            <li key={i} className="fragment fade-in">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);
