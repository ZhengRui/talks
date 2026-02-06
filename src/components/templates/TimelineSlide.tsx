import type { TimelineSlideData, TemplateProps } from "@/lib/types";

export const TimelineSlide: React.FC<TemplateProps<TimelineSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-start",
        gap: "1rem",
      }}
    >
      {slide.events.map((event, i) => (
        <div
          key={i}
          className="fragment fade-in"
          style={{ flex: 1, textAlign: "center" }}
        >
          <strong style={{ fontSize: "1.2em" }}>{event.date}</strong>
          <p style={{ margin: "0.5rem 0 0.25rem" }}>{event.label}</p>
          {event.description && (
            <small style={{ opacity: 0.7 }}>{event.description}</small>
          )}
        </div>
      ))}
    </div>
  </section>
);
