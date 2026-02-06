import type { IframeSlideData, TemplateProps } from "@/lib/types";

export const IframeSlide: React.FC<TemplateProps<IframeSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <iframe
      data-src={slide.src}
      style={{
        width: "100%",
        height: slide.title ? "70vh" : "80vh",
        border: "none",
      }}
    />
  </section>
);
