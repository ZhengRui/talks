import type { ProfileSlideData, TemplateProps } from "@/lib/types";

export const ProfileSlide: React.FC<TemplateProps<ProfileSlideData>> = ({
  slide,
  imageBase,
}) => (
  <section>
    <div
      className="flex flex-col items-center"
      style={{ gap: "0.5em" }}
    >
      {slide.image && (
        <img
          src={`${imageBase}/${slide.image}`}
          alt={slide.name}
          style={{
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      )}
      <h2 style={{ marginBottom: 0 }}>{slide.name}</h2>
      {slide.title && (
        <h4 style={{ marginTop: "0.2em", opacity: 0.8 }}>{slide.title}</h4>
      )}
      {slide.bio && <p style={{ maxWidth: "600px" }}>{slide.bio}</p>}
    </div>
  </section>
);
