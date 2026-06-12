import { useEffect, useState } from "react";
import "./Avatar.css";

interface Props {
  name: string;
  url?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFromName(name: string): string {
  // Color de fondo determinista a partir del nombre: el mismo usuario siempre tiene el mismo color.
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function Avatar({ name, url, className }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImage = Boolean(url) && !failed;

  return (
    <div className={`avatar ${className ?? ""}`.trim()}>
      {showImage ? (
        <img className="avatar__img" src={url ?? undefined} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span className="avatar__initials" style={{ backgroundColor: colorFromName(name) }}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
