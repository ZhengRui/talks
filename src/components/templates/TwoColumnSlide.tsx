import type { TwoColumnSlideData, TemplateProps } from "@/lib/types";

export const TwoColumnSlide: React.FC<TemplateProps<TwoColumnSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div className="flex gap-8">
      <div style={{ flex: 1 }}>{slide.left}</div>
      <div style={{ flex: 1 }}>{slide.right}</div>
    </div>
  </section>
);
