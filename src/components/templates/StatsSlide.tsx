import type { StatsSlideData, TemplateProps } from "@/lib/types";

export const StatsSlide: React.FC<TemplateProps<StatsSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div
      style={{
        display: "flex",
        justifyContent: "space-evenly",
        alignItems: "center",
      }}
    >
      {slide.stats.map((stat, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <p className="text-6xl" style={{ fontWeight: "bold", margin: 0 }}>
            {stat.value}
          </p>
          <p style={{ marginTop: "0.5rem" }}>{stat.label}</p>
        </div>
      ))}
    </div>
  </section>
);
