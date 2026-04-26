interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const sizeMap = {
  sm: { text: "text-lg", icon: 14, gap: "gap-1.5" },
  md: { text: "text-xl", icon: 18, gap: "gap-2" },
  lg: { text: "text-2xl", icon: 22, gap: "gap-2.5" },
};

const BrandLogo = ({ size = "md", showIcon = true }: BrandLogoProps) => {
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center ${s.gap} font-brand font-bold tracking-tight`} style={{ letterSpacing: "-0.02em" }}>
      {showIcon && (
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <path
            d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 5-5 5-5s1 5 5 5a4.49 4.49 0 0 0 1.29-.19l1 2.3 1.89-.66C20.1 16.17 17.9 10 9 8"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 2C9.5 2 7 4 7 8h10c0-4-2.5-6-5-6Z"
            fill="#10B981"
            fillOpacity="0.2"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className={`${s.text} brand-shine-text`}>
        <span style={{ color: "#10B981" }}>Farm</span>
        <span style={{ color: "#F97316" }}>Bondhu</span>
      </span>
    </span>
  );
};

export default BrandLogo;
