import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Migration Hub journey: "Prepare" and "Pay" happen on Migration Hub before
// the customer lands here; this app covers "Connect" and "Migrate".
export const journeySteps = [
  { id: 1, title: "Prepare" },
  { id: 2, title: "Pay" },
  { id: 3, title: "Connect" },
  { id: 4, title: "Migrate" },
];

// Connect-accounts and the Xero/Reckon file-selection pages are all "Connect".
export const getJourneyStep = (pathname: string): number =>
  pathname.toLowerCase().startsWith("/migration-progress") ? 4 : 3;

interface JourneyNavBarProps {
  currentStep?: number;
  onBack?: () => void;
}

const JourneyNavBar = ({ currentStep, onBack }: JourneyNavBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeStep = currentStep ?? getJourneyStep(location.pathname);

  const handleBack = () => {
    if (onBack) return onBack();
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-sm">
      <div className="mx-auto flex h-[72px] max-w-5xl items-center gap-4 px-4 md:gap-8">
        <button
          type="button"
          onClick={handleBack}
          className="flex shrink-0 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <nav
          aria-label="Migration progress"
          className="flex flex-1 items-center justify-between border-b-2 border-violet-600 pb-1"
        >
          {journeySteps.map((step) => {
            const isCurrent = step.id === activeStep;
            const isReached = step.id <= activeStep;

            return (
              <div key={step.id} className="relative flex flex-1 flex-col items-center">
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute -left-1 top-1 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-amber-500 sm:left-0"
                  />
                )}
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    isReached
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-gray-300 bg-white text-gray-400"
                  )}
                >
                  {step.id}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-[11px] font-semibold",
                    isReached ? "text-amber-500" : "text-gray-400"
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default JourneyNavBar;
