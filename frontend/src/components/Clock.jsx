import { useEffect, useState } from "react";

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour12: false });
  const date = now.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="board-clock" aria-label="Current time">
      {time}
      <span className="date">{date}</span>
    </div>
  );
}
