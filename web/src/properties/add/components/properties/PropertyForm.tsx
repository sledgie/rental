import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  DoorOpen,
  FileArchive,
  Info,
  MapPin,
  Plug,
  Save,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { PropertyFormData, PropertyRecord } from "../../types/property";
import { emptyPropertyForm } from "../../data/mockProperties";
import { isMultiUnitType } from "../../types/property";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { generatePropertyId } from "../../store/AppStore";
import { PropertyFormSection, type SectionProps } from "./PropertyFormSection";
import { GeneralFields } from "./GeneralFields";
import { AddressFields } from "./AddressFields";
import { ConfigurationFields } from "./ConfigurationFields";
import { OwnershipFields } from "./OwnershipFields";
import { FinancialFields } from "./FinancialFields";
import { UtilitiesFields } from "./UtilitiesFields";
import { DocumentUpload } from "./DocumentUpload";
import { MaintenanceFields } from "./MaintenanceFields";
import {
  errorCountBySection,
  SECTIONS,
  validateProperty,
  type FormErrors,
  type SectionId,
} from "./validation";
import { cn } from "../../utils/cn";

const SECTION_ICONS: Record<SectionId, typeof Info> = {
  general: Info,
  address: MapPin,
  configuration: Building2,
  ownership: Users,
  financial: DollarSign,
  utilities: Plug,
  documents: FileArchive,
  maintenance: Wrench,
};

const SECTION_META: Record<SectionId, { description: string; optional?: boolean }> = {
  general: { description: "Basic identity of the property in your portfolio." },
  address: { description: "Where the property is located." },
  configuration: { description: "Physical characteristics and building setup." },
  ownership: { description: "Who owns and manages this property." },
  financial: { description: "Purchase, valuation, taxes, insurance, and mortgage.", optional: true },
  utilities: { description: "Service providers and default utility responsibility.", optional: true },
  documents: { description: "Attach ownership, insurance, and compliance documents.", optional: true },
  maintenance: { description: "Defaults used by the Maintenance module.", optional: true },
};

interface PropertyFormProps {
  existing?: PropertyRecord;
  onSave: (record: PropertyRecord) => void;
  onClose: () => void;
}

export function PropertyForm({ existing, onSave, onClose }: PropertyFormProps) {
  const { toast } = useToast();

  const [form, setForm] = useState<PropertyFormData>(() =>
    existing ? { ...existing } : emptyPropertyForm()
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [cancelModal, setCancelModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);

  const set: SectionProps["set"] = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    // clear the field error as the user corrects it
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: undefined } : e));
  };

  // Warn on refresh / tab close with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Scroll-spy for section navigation
  useEffect(() => {
    const sections = containerRef.current?.querySelectorAll("[data-form-section]");
    if (!sections || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSection(visible[0].target.getAttribute("data-form-section") as SectionId);
        }
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const errCounts = useMemo(() => errorCountBySection(errors), [errors]);
  const totalErrors = Object.values(errors).filter(Boolean).length;

  const scrollToSection = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  const buildRecord = (isDraft: boolean): PropertyRecord => ({
    ...form,
    id: existing?.id ?? generatePropertyId(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    isDraft,
  });

  const handleSave = (asDraft: boolean) => {
    const errs = validateProperty(form, asDraft);
    const cleaned = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setErrors(cleaned);
    if (Object.keys(cleaned).length > 0) {
      const counts = errorCountBySection(cleaned);
      const firstSection = SECTIONS.find((s) => counts[s.id] > 0);
      if (firstSection) scrollToSection(firstSection.id);
      toast(
        "warning",
        "Please fix the highlighted fields",
        `${Object.keys(cleaned).length} field${Object.keys(cleaned).length > 1 ? "s need" : " needs"} attention before saving.`
      );
      return;
    }

    const record = buildRecord(asDraft);
    savedRef.current = true;
    onSave(record);
    toast(
      "success",
      existing ? "Property updated" : asDraft ? "Draft saved" : "Property created",
      `${record.name} was saved with ID ${record.id}.`
    );
  };

  const handleCancel = () => {
    if (dirty && !savedRef.current) {
      setCancelModal(true);
    } else {
      onClose();
    }
  };

  const sectionProps: SectionProps = { form, set, errors };

  return (
    <div ref={containerRef}>
      {/* Page header */}
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-moss-500">
          <button type="button" onClick={handleCancel} className="hover:text-moss-300 transition-colors">
            Properties
          </button>
          <span>/</span>
          <span className="text-moss-300">{existing ? "Edit Property" : "Add Property"}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-moss-50">
              {existing ? `Edit ${existing.name}` : "Add New Property"}
            </h1>
            <p className="mt-1 text-sm text-moss-400">
              Register a property and configure its management details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            {!existing && (
              <Button variant="outline" onClick={() => handleSave(true)}>
                Save as Draft
              </Button>
            )}
            <Button variant="primary" onClick={() => handleSave(false)}>
              <Save size={15} /> {existing ? "Save Changes" : "Save Property"}
            </Button>
          </div>
        </div>
      </div>

      {/* Validation summary banner */}
      {totalErrors > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-brick-600/40 bg-brick-500/10 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-brick-400" />
          <p className="text-sm text-brick-300">
            {totalErrors} field{totalErrors > 1 ? "s" : ""} need{totalErrors > 1 ? "" : "s"} attention.
            Jump to a highlighted section below to fix the issues.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Section navigation */}
        <aside className="xl:w-60 xl:shrink-0">
          <nav
            aria-label="Form sections"
            className="sticky top-20 flex gap-1.5 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible xl:pb-0"
          >
            {SECTIONS.map(({ id, label }, idx) => {
              const Icon = SECTION_ICONS[id];
              const active = activeSection === id;
              const errCount = errCounts[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    active
                      ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                      : "border-transparent text-moss-400 hover:bg-moss-800/70 hover:text-moss-200"
                  )}
                >
                  <span
                    className={cn(
                      "hidden h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold xl:flex",
                      active ? "bg-mint-500/25 text-mint-300" : "bg-moss-800 text-moss-500"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <Icon size={15} className="xl:hidden" />
                  <span className="whitespace-nowrap">{label}</span>
                  {errCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brick-500/20 px-1.5 text-[10px] font-semibold text-brick-400">
                      {errCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Form sections */}
        <div className="min-w-0 flex-1 space-y-5">
          <PropertyFormSection id="general" icon={SECTION_ICONS.general} title="General Information" description={SECTION_META.general.description}>
            <GeneralFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="address" icon={SECTION_ICONS.address} title="Property Address" description={SECTION_META.address.description}>
            <AddressFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="configuration" icon={SECTION_ICONS.configuration} title="Property Configuration" description={SECTION_META.configuration.description}>
            <ConfigurationFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="ownership" icon={SECTION_ICONS.ownership} title="Ownership & Management" description={SECTION_META.ownership.description}>
            <OwnershipFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="financial" icon={SECTION_ICONS.financial} title="Financial Information" description={SECTION_META.financial.description} optional>
            <FinancialFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="utilities" icon={SECTION_ICONS.utilities} title="Utilities & Services" description={SECTION_META.utilities.description} optional>
            <UtilitiesFields {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="documents" icon={SECTION_ICONS.documents} title="Documents & Compliance" description={SECTION_META.documents.description} optional>
            <DocumentUpload {...sectionProps} />
          </PropertyFormSection>

          <PropertyFormSection id="maintenance" icon={SECTION_ICONS.maintenance} title="Maintenance & Renovation Defaults" description={SECTION_META.maintenance.description} optional>
            <MaintenanceFields {...sectionProps} />
          </PropertyFormSection>

          {/* Bottom action bar */}
          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-moss-800 bg-moss-950/95 px-1 py-4 backdrop-blur">
            {dirty && !savedRef.current && (
              <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-sand-400">
                <ClipboardList size={13} /> Unsaved changes
              </span>
            )}
            <Button variant="ghost" onClick={handleCancel}>
              <X size={15} /> Cancel
            </Button>
            {!existing && (
              <Button variant="outline" onClick={() => handleSave(true)}>
                Save as Draft
              </Button>
            )}
            <Button variant="primary" onClick={() => handleSave(false)}>
              <Save size={15} /> {existing ? "Save Changes" : "Save Property"}
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel confirmation */}
      <Modal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        title="Discard unsaved changes?"
        description="You have unsaved changes on this form. If you leave now, your changes will be lost."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelModal(false)}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={onClose}>
              Discard & Leave
            </Button>
          </>
        }
      >
        <p className="text-sm text-moss-400">
          Tip: use <span className="text-moss-200">Save as Draft</span> to keep your progress
          without completing every required field.
        </p>
      </Modal>
    </div>
  );
}
