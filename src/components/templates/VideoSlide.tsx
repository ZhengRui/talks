import type { VideoSlideData, TemplateProps } from "@/lib/types";

export const VideoSlide: React.FC<TemplateProps<VideoSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <video
      controls
      style={{ maxWidth: "100%", maxHeight: "70vh", marginTop: "0.5em" }}
    >
      <source src={slide.src} />
    </video>
  </section>
);
