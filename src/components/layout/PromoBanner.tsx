import React from "react";

interface PromoBannerProps {
  id: string;
  imageUrl?: string;
  altText?: string;
  className?: string;
  aspectRatio?: string; // e.g. "aspect-[21/9]"
}

const PromoBanner: React.FC<PromoBannerProps> = ({
  id,
  imageUrl,
  altText = "Banner Promocional",
  className = "",
  aspectRatio = "aspect-[16/4] md:aspect-[21/3]",
}) => {
  // Safe area concept: The image is centered so mobile crop remains predictable.
  // No HTML/Text layers here, just the PNG slot as requested.
  return (
    <div 
      className={`w-full overflow-hidden bg-gray-100 ${className}`}
      data-banner-id={id}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={altText}
          className={`w-full h-full object-cover object-center ${aspectRatio}`}
        />
      ) : (
        <div className={`w-full flex items-center justify-center bg-gray-200 text-gray-400 ${aspectRatio}`}>
          <span className="text-sm font-medium">PNG Slot: {id}</span>
        </div>
      )}
    </div>
  );
};

export default PromoBanner;
