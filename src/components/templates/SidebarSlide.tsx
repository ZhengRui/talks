import type { SidebarSlideData, TemplateProps } from "@/lib/types";

export const SidebarSlide: React.FC<TemplateProps<SidebarSlideData>> = ({
  slide,
}) => {
  const position = slide.sidebarPosition ?? "left";

  const sidebarCol = (
    <div style={{ flex: "0 0 30%" }}>{slide.sidebar}</div>
  );

  const mainCol = (
    <div style={{ flex: "0 0 70%" }}>{slide.main}</div>
  );

  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div className="flex gap-8">
        {position === "left" ? (
          <>
            {sidebarCol}
            {mainCol}
          </>
        ) : (
          <>
            {mainCol}
            {sidebarCol}
          </>
        )}
      </div>
    </section>
  );
};
