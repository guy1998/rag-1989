export default function SakuraLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="8"  rx="3.2" ry="6.5" fill="#FFB7C5" transform="rotate(0,16,16)"   opacity="0.9"/>
      <ellipse cx="16" cy="8"  rx="3.2" ry="6.5" fill="#FF8FAB" transform="rotate(72,16,16)"  opacity="0.85"/>
      <ellipse cx="16" cy="8"  rx="3.2" ry="6.5" fill="#FFB7C5" transform="rotate(144,16,16)" opacity="0.9"/>
      <ellipse cx="16" cy="8"  rx="3.2" ry="6.5" fill="#FF8FAB" transform="rotate(216,16,16)" opacity="0.85"/>
      <ellipse cx="16" cy="8"  rx="3.2" ry="6.5" fill="#FFB7C5" transform="rotate(288,16,16)" opacity="0.9"/>
      <circle  cx="16" cy="16" r="3.8" fill="#FF6B8E"/>
      <circle  cx="16" cy="16" r="1.6" fill="#FFF0F5" opacity="0.7"/>
    </svg>
  );
}
