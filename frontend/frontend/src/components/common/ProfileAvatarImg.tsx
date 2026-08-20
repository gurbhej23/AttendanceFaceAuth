import React from "react";

interface ProfileAvatarImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
}

/** Consistent face-forward framing for circular / squircle avatars. */
export default function ProfileAvatarImg({
  src,
  alt = "",
  className = "",
  ...props
}: ProfileAvatarImgProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`object-cover object-center ${className}`.trim()}
      {...props}
    />
  );
}

