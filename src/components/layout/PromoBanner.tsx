import React from "react";

interface PromoBannerProps {
  id: string;
  imageUrl?: string;
  images?: string[];
  altText?: string;
  className?: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
}

const PromoBanner: React.FC<PromoBannerProps> = ({
  id,
  imageUrl,
  images,
  altText = "Banner Promocional",
  className = "",
  aspectRatio = "aspect-auto",
  style = {},
}) => {
  // Use images array if provided, otherwise fallback to single imageUrl
  const bannerImages = images && images.length > 0 ? images : imageUrl ? [imageUrl] : [];
  const isCarousel = bannerImages.length > 1;

  // For the continuous marquee effect, we duplicate the list of images
  const displayImages = isCarousel ? [...bannerImages, ...bannerImages] : bannerImages;

  return (
    <div 
      className={`w-full overflow-hidden bg-gray-100 ${className}`}
      data-banner-id={id}
      style={{
        ...style,
        aspectRatio: style.aspectRatio || (aspectRatio !== 'aspect-auto' ? aspectRatio.replace('aspect-', '').replace('[', '').replace(']', '').replace('/', ' / ') : undefined)
      }}
    >
      {displayImages.length > 0 ? (
        <div className={isCarousel ? "animate-marquee h-full" : "w-full h-full"}>
          {displayImages.map((src, index) => (
            <div 
              key={`${id}-${index}`} 
              className={isCarousel ? "h-full w-screen shrink-0" : "w-full h-full"}
            >
              <img
                src={src}
                alt={`${altText} ${index + 1}`}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
          <span className="text-sm font-medium">PNG Slot: {id}</span>
        </div>
      )}
    </div>
  );
};

export default PromoBanner;
