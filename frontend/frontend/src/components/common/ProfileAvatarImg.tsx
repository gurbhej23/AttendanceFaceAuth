/** Consistent face-forward framing for circular / squircle avatars. */
export default function ProfileAvatarImg({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`object-cover object-center ${className}`.trim()}
    />
  );
}
