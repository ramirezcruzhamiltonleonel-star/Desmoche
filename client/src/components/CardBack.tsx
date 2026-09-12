const SIZE_CLASSES = {
  sm: "h-14 w-10",
  md: "h-20 w-14",
  lg: "h-24 w-16",
} as const;

export default function CardBack({ size = "sm" }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <div
      className={`shrink-0 rounded-md border-2 border-gold bg-gradient-to-br from-wood to-wood-dark shadow-md ${SIZE_CLASSES[size]}`}
    />
  );
}
