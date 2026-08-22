import React from "react";

interface PromoBannerProps {
  id: string;
  imageUrl?: string;
  altText?: string;
  className?: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
}

const PromoBanner: React.FC<PromoBannerProps> = ({
  id,
  imageUrl,
  altText = "Banner Promocional",
  className = "",
  aspectRatio = "aspect-auto", // Default to auto if not provided
  style = {},
}) => {
  // Safe area concept: The image is centered so mobile crop remains predictable.
  // No HTML/Text layers here, just the PNG slot as requested.
  return (
    <div 
      className={`w-full overflow-hidden bg-gray-100 ${className} ${aspectRatio}`}
      data-banner-id={id}
      style={style}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={altText}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
          <span className="text-sm font-medium">PNG Slot: {id}</span>
        </div>
      )}
    </div>
  );
};

export default PromoBanner;
