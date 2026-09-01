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
}) => {
  const bannerImages = (images?.length ? images : imageUrl ? [imageUrl] : []).filter(
    Boolean,
  );

  if (bannerImages.length === 0) {
    return null;
  }

  const isCarousel = bannerImages.length > 1;
  const displayItems = isCarousel
    ? [...bannerImages, ...bannerImages]
    : bannerImages;

  const parsedAspectRatio =
    style.aspectRatio || aspectRatio === "aspect-auto"
      ? style.aspectRatio
      : aspectRatio
          .replace("aspect-", "")
          .replace("[", "")
          .replace("]", "")
          .replace("/", " / ");

  const content = (
    <div
      className={`w-full overflow-hidden bg-gray-100 transition-all duration-300 ${
        href ? "cursor-pointer hover:shadow-lg" : ""
      } ${className}`}
      data-banner-id={id}
      style={{ ...style, aspectRatio: parsedAspectRatio }}
    >
      <div className={isCarousel ? "animate-marquee h-full" : "h-full w-full"}>
        {displayItems.map((src, index) => (
          <div
            key={`${id}-${index}`}
            className={isCarousel ? "h-full w-screen shrink-0" : "h-full w-full"}
          >
            <img
              src={src}
              alt={isCarousel ? `${altText} ${index + 1}` : altText}
              className={`h-full w-full object-cover transition-all duration-300 ${
                id === "inferior"
                  ? "object-left md:object-center"
                  : id === "superior"
                    ? "aspect-[1774/300]"
                    : "object-center"
              }`}
              style={id === "superior" ? { aspectRatio: "1774 / 300" } : {}}
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
