import type { TableSlideData, TemplateProps } from "@/lib/types";

export const TableSlide: React.FC<TemplateProps<TableSlideData>> = ({
  slide,
}) => (
  <section>
    {slide.title && <h2>{slide.title}</h2>}
    <table>
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
