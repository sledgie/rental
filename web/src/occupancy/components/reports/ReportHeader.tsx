import React from 'react';
import { ArrowLeft, Download, Printer, Calendar, Building2, FileSpreadsheet } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface ReportHeaderProps {
  title: string;
  reportNumber: number;
  description: string;
  asOfDate: string;
  periodLabel?: string;
  propertyContext?: string;
  onBack: () => void;
  onExportCSV: () => void;
}

export function ReportHeader({
  title,
  reportNumber,
  description,
  asOfDate,
  periodLabel,
  propertyContext = 'All Portfolios',
  onBack,
  onExportCSV,
}: ReportHeaderProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Top Breadcrumb & Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-u-line bg-u-card px-3 py-1.5 text-xs font-semibold text-u-ink2 hover:bg-u-s2 transition-colors shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-u-muted" />
          <span>Back to Report Catalog</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-u-line bg-u-card px-3 py-1.5 text-xs font-semibold text-u-ink2 hover:bg-u-s2 transition-colors shadow-xs"
            title="Print this report"
          >
            <Printer className="h-3.5 w-3.5 text-u-muted" />
            <span className="hidden sm:inline">Print Report</span>
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg bg-u-accent px-3.5 py-1.5 text-xs font-semibold text-u-onaccent hover:bg-u-accent-strong transition-colors shadow-xs shadow-u-accent/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Title & Metadata Badges */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-u-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-u-accent-soft text-[11px] font-bold text-u-accent font-mono">
              #{reportNumber}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-u-ink">{title}</h1>
          </div>
          <p className="text-xs text-u-ink2 max-w-3xl leading-relaxed">{description}</p>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-md bg-u-s3 px-2.5 py-1 text-xs text-u-ink2 font-medium border border-u-line">
            <Calendar className="h-3 w-3 text-u-accent" />
            <span>As-Of: {formatDate(asOfDate)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-u-s3 px-2.5 py-1 text-xs text-u-ink2 font-medium border border-u-line">
            <Building2 className="h-3 w-3 text-u-muted" />
            <span>{propertyContext}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
