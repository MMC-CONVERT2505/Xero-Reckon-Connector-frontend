import StepIndicator from "@/components/StepIndicator";
import { migrationSteps, getCurrentStep } from "@/config/steps";
import { useLocation } from "react-router-dom";

const StepPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const currentStep = getCurrentStep(location.pathname);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mb-8">
        <StepIndicator steps={migrationSteps} currentStep={currentStep} />
      </div>
      {children}
    </div>
  );
};

export default StepPage;