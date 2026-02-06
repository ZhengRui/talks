import type { SidebarSlideData, TemplateProps } from "@/lib/types";

export const SidebarSlide: React.FC<TemplateProps<SidebarSlideData>> = ({
  slide,
}) => {
  const position = slide.sidebarPosition ?? "left";

  const sidebarCol = (
    <div
      className={position === "left" ? "anim-slide-left" : "anim-slide-right"}
      style={{
        flex: "0 0 30%",
        background: "var(--sl-bg-secondary)",
        padding: "40px",
        borderRadius: "var(--sl-radius)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <p>{slide.sidebar}</p>
    </div>
  );

  const mainCol = (
    <div
      className={position === "left" ? "anim-slide-right" : "anim-slide-left"}
      style={{
        flex: "1 1 70%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "20px 0",
      }}
    >
      <p>{slide.main}</p>
    </div>
  );

  return (
    <section>
      {slide.title && (
        <h2 className="anim-fade-up" style={{ marginBottom: "32px" }}>{slide.title}</h2>
      )}
      <div style={{ display: "flex", gap: "40px", width: "100%", flex: 1, alignItems: "stretch" }}>
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
