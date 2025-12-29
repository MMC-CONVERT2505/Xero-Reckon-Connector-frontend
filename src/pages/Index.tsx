import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Database } from "lucide-react";
import XeroLogo from "@/components/XeroLogo";
import ReckonLogo from "@/components/ReckonLogo";
import MigrationWizard from "@/components/MigrationWizard";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();



  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent))_0%,transparent_50%)]" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-xero/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-reckon/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          {/* Logo Display */}
          <div className="flex items-center justify-center gap-6 md:gap-12 mb-12 animate-fade-in">
            <div className="group cursor-pointer">
              <XeroLogo className="w-20 h-20 md:w-28 md:h-28 transition-transform group-hover:scale-110 drop-shadow-lg" />
              <p className="text-center mt-2 font-medium text-foreground">Xero</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <div className="w-4 md:w-8 h-0.5 bg-muted-foreground/30" />
                <ArrowRight className="w-6 h-6 md:w-8 md:h-8 text-primary animate-pulse-soft" />
                <div className="w-4 md:w-8 h-0.5 bg-muted-foreground/30" />
              </div>
              <span className="text-xs text-muted-foreground mt-1">migrate</span>
            </div>
            
            <div className="group cursor-pointer">
              <ReckonLogo className="w-20 h-20 md:w-28 md:h-28 transition-transform group-hover:scale-110 drop-shadow-lg" />
              <p className="text-center mt-2 font-medium text-foreground">Reckon</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="text-center max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Seamless Data Migration
              <span className="block text-gradient-brand">Xero to Reckon</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Transfer your accounting data securely and efficiently. 
              Our automated migration tool ensures zero data loss and minimal downtime.
            </p>
            
            <Button
            onClick={() => navigate("/customer-info")}
            size="lg"
            className="text-lg px-8 py-6 group shadow-card hover:shadow-glow-xero transition-all duration-300"
          >
              Data Migration
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-20 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:shadow-soft transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Secure Transfer</h3>
              <p className="text-muted-foreground text-sm">
                Bank-level encryption ensures your financial data remains protected throughout the migration.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:shadow-soft transition-all duration-300">
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Fast & Reliable</h3>
              <p className="text-muted-foreground text-sm">
                Automated processes complete migrations quickly while maintaining data integrity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm hover:shadow-soft transition-all duration-300">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Complete Data</h3>
              <p className="text-muted-foreground text-sm">
                All your invoices, contacts, transactions, and historical data transferred seamlessly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
