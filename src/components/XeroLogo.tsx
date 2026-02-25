import XeroLogoImg from "@/asset/xero-logo.png";

const XeroLogo = ({ className = "" }: { className?: string }) => (
  <img
    src={XeroLogoImg}
    alt="Xero Logo"
    className={className}
  />
);

export default XeroLogo;