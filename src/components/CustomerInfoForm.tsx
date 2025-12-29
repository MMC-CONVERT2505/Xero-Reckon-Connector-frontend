import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Building2,
  Mail,
  Phone,
  User,
  Loader2,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface CustomerInfo {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  startDate: string;
  endDate: string;
}

interface CustomerInfoFormProps {
  onSubmit: (data: CustomerInfo & { fileId?: number }) => void;
}

const CustomerInfoForm = ({ onSubmit }: CustomerInfoFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CustomerInfo>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    startDate: "",
    endDate: "",
  });

  const [errors, setErrors] = useState<Partial<CustomerInfo>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerInfo> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }
    if (!formData.contactName.trim()) {
      newErrors.contactName = "Contact name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.startDate.trim()) {
      newErrors.startDate = "Migration start date is required";
    }
    if (!formData.endDate.trim()) {
      newErrors.endDate = "Migration end date is required";
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        newErrors.endDate = "End date must be after start date";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await api.createCustomerInfo(formData);

      if (response.error) {
        toast({
          title: "Error",
          description:
            response.error.message ||
            "Failed to save customer information",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const jobId = response.data?.job_id;

      const customerInfoToStore = {
        ...formData,
        jobId,
      };
      localStorage.setItem(
        "customerInfo",
        JSON.stringify(customerInfoToStore)
      );
      localStorage.setItem("jobId", String(jobId));
      localStorage.setItem("migrationStartDate", formData.startDate);
      localStorage.setItem("migrationEndDate", formData.endDate);

      toast({
        title: "Information saved",
        description:
          response.data?.message ||
          "Your details have been recorded successfully.",
      });

      onSubmit({
        ...formData,
        fileId: jobId,
      });

      navigate("/connect-accounts");
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CustomerInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Customer Information
        </h2>
        <p className="text-muted-foreground">
          Please provide your business details to proceed with the migration
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Company Name
          </Label>
          <Input
            id="companyName"
            placeholder="Enter your company name"
            value={formData.companyName}
            onChange={(e) => handleChange("companyName", e.target.value)}
            className={errors.companyName ? "border-destructive" : ""}
          />
          {errors.companyName && (
            <p className="text-sm text-destructive">{errors.companyName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName" className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Contact Name
          </Label>
          <Input
            id="contactName"
            placeholder="Enter contact person's name"
            value={formData.contactName}
            onChange={(e) => handleChange("contactName", e.target.value)}
            className={errors.contactName ? "border-destructive" : ""}
          />
          {errors.contactName && (
            <p className="text-sm text-destructive">{errors.contactName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Phone Number
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="Enter your phone number"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone}</p>
          )}
        </div>

        {/* Migration dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Migration Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange("startDate", e.target.value)}
              className={errors.startDate ? "border-destructive" : ""}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Migration End Date
            </Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => handleChange("endDate", e.target.value)}
              className={errors.endDate ? "border-destructive" : ""}
            />
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate}</p>
            )}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full group"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            Continue to Connection
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>
    </form>
  );
};

export default CustomerInfoForm;