// Kew — keklik (chukar partridge) mark. Cybergah Group.
// The vector mark itself (same source as every launcher icon), so it stays
// sharp at any size.
import logoUrl from "./keklik.svg";

export function KewLogo({ size = 96 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="Kew"
      draggable={false}
      style={{ display: "inline-block", verticalAlign: "middle", userSelect: "none" }}
    />
  );
}
