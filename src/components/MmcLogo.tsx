import MmcLogoImg from "@/asset/mmc_logo.png";

const MmcLogo = ({ className = "" }: { className?: string }) => (
  <img
    src={MmcLogoImg}
    alt="MMC Logo"
    className={className}
  />
);

export default MmcLogo;