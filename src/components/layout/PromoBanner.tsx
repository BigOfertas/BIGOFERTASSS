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
  altText = "Banner Promocional",
  className = "",
  aspectRatio = "aspect-auto",
  style = {},
  href,
}) => {
  // Use images array if provided, otherwise fallback to single imageUrl
  // If no images at all, we might still want multiple "slots" for the marquee
  const bannerImages = images && images.length > 0 ? images : imageUrl ? [imageUrl] : [];
  
  // If it's the superior banner and we want a marquee, ensure we have slots even without images
  const slots = bannerImages.length > 0 ? bannerImages : id === 'superior' ? ['', '', ''] : [];
  const isCarousel = slots.length > 1;

  // For the continuous marquee effect, we duplicate the list to ensure a seamless infinite loop
  const displayItems = isCarousel ? [...slots, ...slots] : slots;

  const content = (
    <div 
      className={`w-full overflow-hidden bg-gray-100 transition-all duration-300 ${href ? 'hover:shadow-lg cursor-pointer' : ''} ${className}`}
      data-banner-id={id}
      style={{
        ...style,
        aspectRatio: style.aspectRatio || (aspectRatio !== 'aspect-auto' ? aspectRatio.replace('aspect-', '').replace('[', '').replace(']', '').replace('/', ' / ') : undefined)
      }}
    >
      {displayItems.length > 0 ? (
        <div className={isCarousel ? "animate-marquee h-full" : "w-full h-full"}>
          {displayItems.map((src, index) => (
            <div 
              key={`${id}-${index}`} 
              className={isCarousel ? "h-full w-screen shrink-0" : "w-full h-full"}
            >
              {src ? (
                <img
                  src={src}
                  alt={`${altText} ${index + 1}`}
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    id === 'inferior' ? 'object-left md:object-center' : 
                    id === 'superior' ? 'aspect-[1774/300]' : 
                    'object-center'
                  }`}
                  style={id === 'superior' ? { aspectRatio: '1774 / 300' } : {}}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 border-x border-gray-300">
                  <span className="text-sm font-medium">PNG Slot: {id} {isCarousel ? (index % slots.length) + 1 : ''}</span>
                </div>
              )}
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

  if (href) {
    return (
      <a href={href} className="block w-full">
        {content}
      </a>
    );
  }

  return content;
};

export default PromoBanner;
