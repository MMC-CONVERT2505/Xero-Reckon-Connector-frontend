import { ArrowDownUp } from "lucide-react";
import { useLocation } from "react-router-dom";
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

// Header links point at the Migration Hub marketing site.
const MIGRATION_HUB_URL = import.meta.env.VITE_MIGRATION_HUB_URL ?? "";

const hubLinks = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

interface JourneyNavBarProps {
  currentStep?: number;
}

const JourneyNavBar = ({ currentStep }: JourneyNavBarProps) => {
  const location = useLocation();
  const activeStep = currentStep ?? getJourneyStep(location.pathname);

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Brand bar */}
      <div className="bg-slate-100">
        <div className="mx-auto flex h-[60px] items-center justify-between gap-4 px-4 sm:px-5">
          <a href={MIGRATION_HUB_URL || "/"} className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white">
              <ArrowDownUp className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold text-violet-700">Migration Hub</span>
              <span className="text-[10px] text-slate-700">Powered by MMC Convert</span>
            </span>
          </a>

          <nav aria-label="Migration Hub" className="hidden items-center gap-6 md:flex">
            {hubLinks.map((link) => (
              <a
                key={link.label}
                href={`${MIGRATION_HUB_URL}/${link.href}`}
                className="rounded-full bg-slate-50 px-3 py-1 text-[13px] text-slate-600 transition-colors hover:bg-white hover:text-violet-700"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Journey stepper */}
      <div className="bg-white">
        <nav
          aria-label="Migration progress"
          className="mx-auto flex max-w-[660px] items-start border-b-2 border-violet-600 px-2 pt-1.5 pb-0.5"
        >
          {journeySteps.map((step) => {
            const isCurrent = step.id === activeStep;
            const isReached = step.id <= activeStep;

            return (
              <div key={step.id} className="relative flex flex-1 flex-col items-center">
                {isCurrent && step.id > 1 && (
                  // Arrow sits midway between the previous step and the current one.
                  <span
                    aria-hidden
                    className="absolute left-0 top-[6px] h-0 w-0 -translate-x-1/2 border-y-[6px] border-l-[10px] border-y-transparent border-l-amber-500"
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
