const ReckonLogo = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="50" cy="50" r="50" fill="#E94E1B" />
    <text
      x="50"
      y="58"
      textAnchor="middle"
      fill="white"
      fontSize="28"
      fontWeight="bold"
      fontFamily="sans-serif"
    >
      R
    </text>
    <path
      d="M25 70 L40 55 L55 70 L75 50"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default ReckonLogo;
