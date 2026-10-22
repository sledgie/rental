import React, { useState } from "react";
import { X, Sliders, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { DEFAULT_THRESHOLDS } from "../../lib/calculations";
import { ThresholdSettings } from "../../lib/types";

export function ThresholdModal() {
  const { thresholds, setThresholds, isThresholdModalOpen, setIsThresholdModalOpen } = useProjectReports();
  const [localSettings, setLocalSettings] = useState<ThresholdSettings>(thresholds);

  if (!isThresholdModalOpen) return null;

  const handleSave = () => {
    setThresholds(localSettings);
    setIsThresholdModalOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_THRESHOLDS);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-u-card p-6 shadow-2xl border border-u-line">
        <button
          onClick={() => setIsThresholdModalOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink2"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-u-accent-soft text-u-accent">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-u-ink">Governance & Alert Thresholds</h3>
            <p className="text-xs text-u-muted">Configure portfolio sensitivity for budget alerts and schedule delays</p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-xs">
          {/* Budget Consumption Warning */}
          <div className="rounded-xl border border-u-line p-3 bg-u-s2/50">
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-u-ink">Budget Consumption Warning Limit</label>
              <span className="font-bold text-u-warn bg-u-warn-soft px-2 py-0.5 rounded border border-u-warn/30">
                {localSettings.warningBudgetConsumption}%
              </span>
            </div>
            <p className="text-[11px] text-u-muted mb-2">
              Triggers a warning if project has spent this % of approved budget while progress is under {localSettings.warningProgressThreshold}%.
            </p>
            <input
              type="range"
              min="70"
              max="98"
              step="1"
              value={localSettings.warningBudgetConsumption}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, warningBudgetConsumption: parseFloat(e.target.value) })
              }
              className="w-full accent-u-accent cursor-pointer"
            />
          </div>

          {/* Substantial Completion Progress Threshold */}
          <div className="rounded-xl border border-u-line p-3 bg-u-s2/50">
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-u-ink">Substantial Completion Progress Cutoff</label>
              <span className="font-bold text-u-accent bg-u-accent-soft px-2 py-0.5 rounded border border-u-accent/30">
                {localSettings.warningProgressThreshold}%
              </span>
            </div>
            <p className="text-[11px] text-u-muted mb-2">
              Threshold below which high spending is treated as an early budget consumption risk.
            </p>
            <input
              type="range"
              min="60"
              max="95"
              step="1"
              value={localSettings.warningProgressThreshold}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, warningProgressThreshold: parseFloat(e.target.value) })
              }
              className="w-full accent-u-accent cursor-pointer"
            />
          </div>

          {/* Critical Overrun Threshold */}
          <div className="rounded-xl border border-u-line p-3 bg-u-s2/50">
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-u-ink">Critical Budget Overrun Threshold</label>
              <span className="font-bold text-u-danger bg-u-danger-soft px-2 py-0.5 rounded border border-u-danger/30">
                &gt; {localSettings.criticalOverrunPct}%
              </span>
            </div>
            <p className="text-[11px] text-u-muted mb-2">
              Projects with forecast final cost exceeding approved budget by more than this % are marked Critical.
            </p>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={localSettings.criticalOverrunPct}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, criticalOverrunPct: parseFloat(e.target.value) })
              }
              className="w-full accent-u-danger cursor-pointer"
            />
          </div>

          {/* Schedule Delay Warning Days */}
          <div className="rounded-xl border border-u-line p-3 bg-u-s2/50">
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-u-ink">Schedule Delay Tolerance (Days)</label>
              <span className="font-bold text-u-ink bg-u-line px-2 py-0.5 rounded">
                {localSettings.delayedDaysWarning} Days
              </span>
            </div>
            <p className="text-[11px] text-u-muted mb-2">
              Calendar days of positive variance past baseline before project status changes to "Delayed".
            </p>
            <input
              type="range"
              min="1"
              max="21"
              step="1"
              value={localSettings.delayedDaysWarning}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, delayedDaysWarning: parseFloat(e.target.value) })
              }
              className="w-full accent-u-accent cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-u-line pt-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-u-muted hover:text-u-ink font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Defaults</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setIsThresholdModalOpen(false)}
              className="rounded-lg border border-u-line px-3.5 py-1.5 text-xs font-medium text-u-ink2 hover:bg-u-s2"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-u-accent px-4 py-1.5 text-xs font-semibold text-u-onaccent shadow-xs hover:bg-u-accent-strong"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Apply Thresholds</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
