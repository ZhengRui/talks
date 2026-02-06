import type { TableSlideData, TemplateProps } from "@/lib/types";

export const TableSlide: React.FC<TemplateProps<TableSlideData>> = ({
  slide,
}) => (
  <section className={slide.animation === "none" ? "anim-none" : undefined}>
    {slide.title && (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
        <h2 className="anim-fade-up">{slide.title}</h2>
        <div className="sl-accent-line anim-fade-up" style={{ '--delay': '100ms' } as React.CSSProperties} />
      </div>
    )}
    <table
      className="sl-table anim-fade-in"
      style={{ '--delay': '200ms' } as React.CSSProperties}
    >
      <thead>
        <tr>
          {slide.headers.map((header, i) => (
            <th key={i}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slide.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
