interface StatusBadgeProps {
  status: string;
  children?: string;
  className?: string;
}

export default function StatusBadge({ status, children, className = "" }: StatusBadgeProps) {
  const token = status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`status-badge status-${token} ${className}`.trim()}>{children ?? status}</span>;
}