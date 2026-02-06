import type { HighlightBoxSlideData, TemplateProps } from "@/lib/types";

const variantStyles: Record<
  string,
  { background: string; border: string }
> = {
  info: { background: "rgba(59, 130, 246, 0.15)", border: "#3b82f6" },
  warning: { background: "rgba(234, 179, 8, 0.15)", border: "#eab308" },
  success: { background: "rgba(34, 197, 94, 0.15)", border: "#22c55e" },
};

export const HighlightBoxSlide: React.FC<
  TemplateProps<HighlightBoxSlideData>
> = ({ slide }) => {
  const variant = slide.variant ?? "info";
  const styles = variantStyles[variant];

  return (
    <section>
      {slide.title && <h2>{slide.title}</h2>}
      <div
        style={{
          background: styles.background,
          borderLeft: `4px solid ${styles.border}`,
          borderRadius: "0.5em",
          padding: "1.5em",
          marginTop: "1em",
          textAlign: "left",
          fontSize: "1.1em",
        }}
      >
        {slide.body}
      </div>
    </section>
  );
};
