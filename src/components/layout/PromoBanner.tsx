import React from "react";

interface PromoBannerProps {
  id: string;
  imageUrl?: string;
  images?: string[];
  altText?: string;
  className?: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
  href?: string;
  priority?: boolean;
}

const PromoBanner: React.FC<PromoBannerProps> = ({
  id,
  imageUrl,
  images,
  altText = "Banner promocional",
  className = "",
  aspectRatio = "aspect-auto",
  style = {},
  href,
  priority = false,
}) => {
  const bannerImages = (images?.length ? images : imageUrl ? [imageUrl] : []).filter(Boolean);

  if (bannerImages.length === 0) return null;

  const isCarousel = bannerImages.length > 1;
  const displayItems = isCarousel ? [...bannerImages, ...bannerImages] : bannerImages;
  const parsedAspectRatio =
    style.aspectRatio || aspectRatio === "aspect-auto"
      ? style.aspectRatio
      : aspectRatio.replace("aspect-", "").replace("[", "").replace("]", "").replace("/", " / ");

  const content = (
    <div
      className={`w-full overflow-hidden bg-gray-100 ${href ? "cursor-pointer" : ""} ${className}`}
      data-banner-id={id}
      style={{ ...style, aspectRatio: parsedAspectRatio }}
    >
      <div
        className={
          isCarousel
            ? `animate-marquee h-full ${id === "superior" ? "animate-marquee--fast marquee-continuous" : ""}`
            : "h-full w-full"
        }
        style={id === "superior" && isCarousel ? { animationPlayState: "running" } : undefined}
      >
        {displayItems.map((src, index) => (
          <div
            key={`${id}-${index}`}
            className={isCarousel ? "h-full w-screen shrink-0" : "h-full w-full"}
          >
            <img
              src={src}
              alt={isCarousel ? `${altText} ${index + 1}` : altText}
              loading={priority && index === 0 ? "eager" : "lazy"}
              fetchPriority={priority && index === 0 ? "high" : "auto"}
              decoding="async"
              className={`h-full w-full object-cover ${
                id === "inferior" ? "object-left md:object-center" : "object-center"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block w-full">
      {content}
    </a>
  ) : (
    content
  );
};

export default PromoBanner;
