import React from 'react';
import { ReportFilterState } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { LeasingFunnelChart } from '../charts/LeasingFunnelChart';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Users, Filter, ArrowRight, UserCheck, TrendingUp } from 'lucide-react';

interface Report8Props {
  filters: ReportFilterState;
  onBack: () => void;
}

export function Report8LeasingPipeline({ filters, onBack }: Report8Props) {
  const { propertyRows, funnelTotals, conversionRates, avgTimeToLeaseDays } =
    OccupancyService.getLeasingPipelineReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `leasing-pipeline-${filters.asOfDate}`,
      reportTitle: 'Leasing Pipeline & Conversion Report',
      reportingPeriod: `Month ending ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Inquiries', accessor: (r) => r.inquiries },
        { header: 'Applications Received', accessor: (r) => r.applicationsReceived },
        { header: 'Applications Approved', accessor: (r) => r.applicationsApproved },
        { header: 'Applications Declined', accessor: (r) => r.applicationsDeclined },
        { header: 'Leases Offered', accessor: (r) => r.leasesOffered },
        { header: 'Leases Signed', accessor: (r) => r.leasesSigned },
        { header: 'Completed Move-Ins', accessor: (r) => r.completedMoveIns },
        { header: 'App-to-Lease Ratio', accessor: (r) => formatPercent(r.conversionAppToLease) },
        { header: 'Avg Days to Lease', accessor: (r) => `${r.avgTimeToLeaseDays} d` },
        { header: 'Agent', accessor: (r) => r.assignedAgent || '—' },
      ],
      data: propertyRows,
      summaryNotes: [
        'Application-to-Lease Conversion = Leases Signed ÷ Applications Received × 100.',
        'Inquiry-to-Application Conversion = Applications Received ÷ Inquiries × 100.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Leasing Pipeline & Conversion Report"
        reportNumber={8}
        description="Tracks applicant volume and leasing velocity across each stage of the funnel: inquiry, application, credit screening, offer, and move-in."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Visual Funnel */}
      <LeasingFunnelChart
        inquiries={funnelTotals.inquiries}
        applicationsReceived={funnelTotals.applicationsReceived}
        applicationsApproved={funnelTotals.applicationsApproved}
        leasesOffered={funnelTotals.leasesOffered}
        leasesSigned={funnelTotals.leasesSigned}
        completedMoveIns={funnelTotals.completedMoveIns}
        avgTimeToLeaseDays={avgTimeToLeaseDays}
      />

      {/* Property Pipeline Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold text-right">Inquiries</th>
                <th className="py-3 px-3 font-semibold text-right">Applications</th>
                <th className="py-3 px-3 font-semibold text-right">Approved</th>
                <th className="py-3 px-3 font-semibold text-right">Declined</th>
                <th className="py-3 px-3 font-semibold text-right">Offered</th>
                <th className="py-3 px-3 font-semibold text-right font-bold text-u-accent">Signed</th>
                <th className="py-3 px-3 font-semibold text-right">Move-Ins</th>
                <th className="py-3 px-3 font-semibold text-right text-u-ok">App-to-Lease %</th>
                <th className="py-3 px-4 font-semibold">Leasing Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {propertyRows.map((r) => (
                <tr key={r.propertyId} className="hover:bg-u-s2 transition-colors font-medium">
                  <td className="py-3.5 px-4 font-bold text-u-ink">{r.propertyName}</td>
                  <td className="py-3.5 px-3 text-right font-mono">{r.inquiries}</td>
                  <td className="py-3.5 px-3 text-right font-mono">{r.applicationsReceived}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-ok font-semibold">{r.applicationsApproved}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-danger">{r.applicationsDeclined}</td>
                  <td className="py-3.5 px-3 text-right font-mono">{r.leasesOffered}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-u-accent">{r.leasesSigned}</td>
                  <td className="py-3.5 px-3 text-right font-mono">{r.completedMoveIns}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-u-ok">
                    {formatPercent(r.conversionAppToLease)}
                  </td>
                  <td className="py-3.5 px-4 text-u-ink2">{r.assignedAgent}</td>
                </tr>
              ))}

              {/* Portfolio Totals */}
              <tr className="bg-u-s3 font-bold text-u-ink border-t-2 border-u-line2">
                <td className="py-3.5 px-4">Portfolio Aggregate</td>
                <td className="py-3.5 px-3 text-right font-mono">{funnelTotals.inquiries}</td>
                <td className="py-3.5 px-3 text-right font-mono">{funnelTotals.applicationsReceived}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-ok">{funnelTotals.applicationsApproved}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-danger">{funnelTotals.applicationsDeclined}</td>
                <td className="py-3.5 px-3 text-right font-mono">{funnelTotals.leasesOffered}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-accent">{funnelTotals.leasesSigned}</td>
                <td className="py-3.5 px-3 text-right font-mono">{funnelTotals.completedMoveIns}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-ok text-sm">
                  {formatPercent(conversionRates.applicationToLease)}
                </td>
                <td className="py-3.5 px-4 text-u-muted font-mono">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
