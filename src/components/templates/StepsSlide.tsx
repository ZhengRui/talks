import type { StepsSlideData, TemplateProps } from "@/lib/types";

export const StepsSlide: React.FC<TemplateProps<StepsSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div style={{ marginTop: "1em", textAlign: "left" }}>
      {slide.steps.map((step, i) => (
        <div
          key={i}
          className="fragment fade-in flex items-start gap-4"
          style={{ marginBottom: "0.75em" }}
        >
          <span
            className="font-bold"
            style={{
              fontSize: "2em",
              lineHeight: 1,
              minWidth: "1.5em",
              textAlign: "center",
              opacity: 0.5,
            }}
          >
            {i + 1}
          </span>
          <div>
            <strong style={{ fontSize: "1.1em" }}>{step.label}</strong>
            {step.description && (
              <p style={{ margin: "0.2em 0 0", opacity: 0.8 }}>
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>
);
