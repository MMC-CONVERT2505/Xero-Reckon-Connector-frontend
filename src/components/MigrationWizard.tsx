import { useState } from "react";
import StepIndicator from "./StepIndicator";
import CustomerInfoForm from "./CustomerInfoForm";
import ConnectionStep from "./ConnectionStep";
import MigrationProgress from "./MigrationProgress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import XeroLogo from "./XeroLogo";
import ReckonLogo from "./ReckonLogo";

interface CustomerInfo {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  fileId?: number;
}

const steps = [
  { id: 1, title: "Customer Info" },
  { id: 2, title: "Connect Accounts" },
  { id: 3, title: "Migration" },
  { id: 4, title: "Complete" },
];

const MigrationWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [xeroToolId, setXeroToolId] = useState<number | null>(null);
  const [reckonToolId, setReckonToolId] = useState<number | null>(null);

  const handleCustomerInfoSubmit = (data: CustomerInfo) => {
    setCustomerInfo(data);
    if (data.fileId) {
      setFileId(data.fileId);
    }
    setCurrentStep(2);
  };

  const handleConnectionComplete = () => {
    setCurrentStep(3);
  };

  const handleMigrationComplete = () => {
    setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <XeroLogo className="w-12 h-12" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-0.5 bg-muted" />
              <Sparkles className="w-5 h-5 text-primary" />
              <div className="w-8 h-0.5 bg-muted" />
            </div>
            <ReckonLogo className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Data Migration
          </h1>
          <p className="text-muted-foreground">
            Seamlessly migrate your data from Xero to Reckon
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator steps={steps} currentStep={currentStep} />
        </div>

        {/* Back Button */}
        {currentStep > 1 && currentStep < 3 && (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

        {/* Content Card */}
        <Card className="p-6 md:p-8 shadow-card border-border/50">
          {currentStep === 1 && (
            <CustomerInfoForm onSubmit={handleCustomerInfoSubmit} />
          )}

          {currentStep === 2 && (
            <ConnectionStep 
              onComplete={handleConnectionComplete}
              fileId={fileId}
              onToolIdsSet={(xeroId, reckonId) => {
                setXeroToolId(xeroId);
                setReckonToolId(reckonId);
              }}
            />
          )}

          {currentStep === 3 && (
            <MigrationProgress 
              onComplete={handleMigrationComplete}
              fileId={fileId}
              xeroToolId={xeroToolId}
              reckonToolId={reckonToolId}
            />
          )}

          {currentStep === 4 && (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Migration Complete!
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Your data has been successfully migrated from Xero to Reckon. 
                We've sent a confirmation to {customerInfo?.email}.
              </p>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-xero">14,964</p>
                  <p className="text-xs text-muted-foreground">Records Migrated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-reckon">6</p>
                  <p className="text-xs text-muted-foreground">Categories</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 p-4 bg-primary/5 rounded-lg">
                <XeroLogo className="w-10 h-10 opacity-50" />
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <ReckonLogo className="w-10 h-10" />
              </div>
              <Button
                className="mt-6"
                onClick={() => setCurrentStep(1)}
              >
                Start New Migration
              </Button>
            </div>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Your data is encrypted and securely transferred between platforms
        </p>
      </div>
    </div>
  );
};

export default MigrationWizard;
