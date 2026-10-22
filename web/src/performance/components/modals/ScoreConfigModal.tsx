import React, { useState } from "react";
import { useReportContext } from "../../context/ReportContext";
import { X, Settings2, Sliders, RotateCcw, Check, AlertCircle } from "lucide-react";
import { DEFAULT_WEIGHTS } from "../../lib/scoring";
import { ScoreWeights } from "../../types/performance";

export function ScoreConfigModal() {
  const {
    isConfigModalOpen,
    setIsConfigModalOpen,
    weights,
    setWeights,
    resetWeightsToDefault,
    recalculateData,
  } = useReportContext();

  const [localWeights, setLocalWeights] = useState<ScoreWeights>(weights);

  if (!isConfigModalOpen) return null;

  const totalWeight =
    localWeights.maintenance +
    localWeights.condition +
    localWeights.retention +
    localWeights.efficiency +
    localWeights.lifecycle;

  const isValidTotal = totalWeight === 100;

  const handleSliderChange = (category: keyof ScoreWeights, value: number) => {
    setLocalWeights((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  const handleApply = async () => {
    if (!isValidTotal) return;
    setWeights(localWeights);
    setIsConfigModalOpen(false);
    await recalculateData();
  };

  const handleReset = () => {
    setLocalWeights(DEFAULT_WEIGHTS);
    resetWeightsToDefault();
    setIsConfigModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-u-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-u-line animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-u-line flex items-center justify-between bg-u-s2/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-u-ink">Scorecard Weighting Model</h3>
              <p className="text-xs text-u-muted">Configure operational category weights (must total 100%)</p>
            </div>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(false)}
            className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Total Weight Status Bar */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isValidTotal
                ? "bg-u-ok-soft border-u-ok/30 text-u-ok"
                : "bg-u-warn-soft border-u-warn/30 text-u-warn"
            }`}
          >
            <div className="flex items-center gap-2">
              {isValidTotal ? (
                <Check className="w-4 h-4 text-u-ok shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-u-warn shrink-0" />
              )}
              <span className="text-xs font-semibold">
                {isValidTotal
                  ? "Weights properly balanced to 100%"
                  : `Total weight is ${totalWeight}% (must equal exactly 100%)`}
              </span>
            </div>
            <span className="text-sm font-bold">{totalWeight}%</span>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            {/* Maintenance */}
            <div>
              <div className="flex justify-between text-xs font-medium text-u-ink2 mb-1">
                <span>Maintenance & Work Orders</span>
                <span className="font-bold text-u-accent">{localWeights.maintenance}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={localWeights.maintenance}
                onChange={(e) => handleSliderChange("maintenance", Number(e.target.value))}
                className="w-full accent-u-accent cursor-pointer"
              />
              <p className="text-[11px] text-u-muted">SLA compliance, repeat failures, backlog aging</p>
            </div>

            {/* Condition */}
            <div>
              <div className="flex justify-between text-xs font-medium text-u-ink2 mb-1">
                <span>Property Condition & Inspections</span>
                <span className="font-bold text-u-accent">{localWeights.condition}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={localWeights.condition}
                onChange={(e) => handleSliderChange("condition", Number(e.target.value))}
                className="w-full accent-u-accent cursor-pointer"
              />
              <p className="text-[11px] text-u-muted">Pass rate, critical safety findings, structural defects</p>
            </div>

            {/* Retention */}
            <div>
              <div className="flex justify-between text-xs font-medium text-u-ink2 mb-1">
                <span>Tenant Retention & Service Quality</span>
                <span className="font-bold text-u-accent">{localWeights.retention}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="5"
                value={localWeights.retention}
                onChange={(e) => handleSliderChange("retention", Number(e.target.value))}
                className="w-full accent-u-accent cursor-pointer"
              />
              <p className="text-[11px] text-u-muted">Renewal acceptance rate, complaint resolution, tenancy length</p>
            </div>

            {/* Efficiency */}
            <div>
              <div className="flex justify-between text-xs font-medium text-u-ink2 mb-1">
                <span>Operational Efficiency</span>
                <span className="font-bold text-u-accent">{localWeights.efficiency}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="5"
                value={localWeights.efficiency}
                onChange={(e) => handleSliderChange("efficiency", Number(e.target.value))}
                className="w-full accent-u-accent cursor-pointer"
              />
              <p className="text-[11px] text-u-muted">Unit turnaround duration, contractor responsiveness, PM ratio</p>
            </div>

            {/* Lifecycle */}
            <div>
              <div className="flex justify-between text-xs font-medium text-u-ink2 mb-1">
                <span>Asset Lifecycle & Preventive Preservation</span>
                <span className="font-bold text-u-accent">{localWeights.lifecycle}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="5"
                value={localWeights.lifecycle}
                onChange={(e) => handleSliderChange("lifecycle", Number(e.target.value))}
                className="w-full accent-u-accent cursor-pointer"
              />
              <p className="text-[11px] text-u-muted">Asset remaining useful life, deferred maintenance avoidance</p>
            </div>
          </div>

          <div className="pt-4 border-t border-u-line flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-u-muted hover:text-u-ink font-medium px-2 py-1 rounded hover:bg-u-s3"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults (25/25/20/10)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-u-ink2 hover:bg-u-s3 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isValidTotal}
                onClick={handleApply}
                className="px-4 py-1.5 text-xs font-medium text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg disabled:opacity-40 transition"
              >
                Apply & Recalculate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
