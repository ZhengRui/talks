import type { IconGridSlideData, TemplateProps } from "@/lib/types";

export const IconGridSlide: React.FC<TemplateProps<IconGridSlideData>> = ({
  slide,
}) => {
  const columns = slide.columns ?? 3;

  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "1.5em",
          marginTop: "1em",
        }}
      >
        {slide.items.map((item, i) => (
          <div key={i} className="text-center">
            <div style={{ fontSize: "2.5em" }}>{item.icon}</div>
            <p style={{ marginTop: "0.3em" }}>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
