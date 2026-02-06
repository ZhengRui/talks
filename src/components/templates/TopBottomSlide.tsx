import type { TopBottomSlideData, TemplateProps } from "@/lib/types";

export const TopBottomSlide: React.FC<TemplateProps<TopBottomSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <div className="flex flex-col justify-between" style={{ height: "60vh" }}>
      <div>{slide.top}</div>
      <div>{slide.bottom}</div>
    </div>
  </section>
);
