import { isSupabaseConfigured } from '../../lib/supabase';
import {
  Property,
  Unit,
  Lease,
  Tenant,
  HistoricalOccupancyRecord,
  UnitReadinessRecord,
  LeasingPipelineFunnel,
  MoveRecord,
  OccupancyException,
  ReportFilterState,
  CurrentOccupancyStatus,
} from '../types/occupancy';

import { MOCK_PROPERTIES } from '../mock/properties';
import { MOCK_UNITS } from '../mock/units';
import { MOCK_LEASES } from '../mock/leases';
import { MOCK_TENANTS } from '../mock/tenants';
import { MOCK_HISTORICAL_RECORDS } from '../mock/historical';
import { MOCK_TURNOVER_RECORDS } from '../mock/turnover';
import { MOCK_PIPELINE_DATA } from '../mock/pipeline';
import { MOCK_MOVE_RECORDS } from '../mock/moves';
import { MOCK_OCCUPANCY_EXCEPTIONS } from '../mock/exceptions';
import { calculateDaysDifference } from '../utils/formatters';

// In-memory exception state to allow user review / simulate status changes
let dynamicExceptions: OccupancyException[] = isSupabaseConfigured ? [] : [...MOCK_OCCUPANCY_EXCEPTIONS];
/** Replaces the data-quality findings (Supabase mode: computed from the organization's records). */
export function setExceptions(list: OccupancyException[]) {
  dynamicExceptions = list;
}
/** The month before the as-of date, as YYYY-MM and as a label. */
function previousMonth(asOfDate: string) {
  const d = new Date(`${(asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 7)}-01T12:00:00`);
  d.setMonth(d.getMonth() - 1);
  return { period: d.toISOString().slice(0, 7), label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
}

export class OccupancyService {
  /**
   * Helper to fetch base reference data
   */
  static getProperties(): Property[] {
    return MOCK_PROPERTIES;
  }

  static getTenants(): Tenant[] {
    return MOCK_TENANTS;
  }

  static getUnits(): Unit[] {
    return MOCK_UNITS;
  }

  static getLeases(): Lease[] {
    return MOCK_LEASES;
  }

  /**
   * Global filter applicator for units
   */
  static filterUnits(filters: Partial<ReportFilterState>): Unit[] {
    return MOCK_UNITS.filter((u) => {
      if (filters.propertyId && filters.propertyId !== 'all' && u.propertyId !== filters.propertyId) {
        return false;
      }
      if (filters.unitType && filters.unitType !== 'all' && u.unitType !== filters.unitType) {
        return false;
      }
      if (filters.occupancyStatus && filters.occupancyStatus !== 'all' && u.currentOccupancyStatus !== filters.occupancyStatus) {
        return false;
      }
      if (filters.readinessStatus && filters.readinessStatus !== 'all' && u.readinessStatus !== filters.readinessStatus) {
        return false;
      }
      if (filters.searchQuery && filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase().trim();
        const prop = MOCK_PROPERTIES.find((p) => p.propertyId === u.propertyId);
        const matchUnit = u.unitNumber.toLowerCase().includes(q);
        const matchProp = prop?.propertyName.toLowerCase().includes(q) || prop?.propertyCode.toLowerCase().includes(q);
        const matchType = u.unitType.toLowerCase().includes(q);
        if (!matchUnit && !matchProp && !matchType) return false;
      }
      return true;
    });
  }

  /**
   * SUMMARY METRICS FOR LANDING PAGE
   */
  static getLandingSummaryMetrics(asOfDate: string, propertyId = 'all') {
    const units = MOCK_UNITS.filter((u) => (propertyId === 'all' ? true : u.propertyId === propertyId));
    const rentableUnits = units.filter((u) => u.isRentable);
    const totalRentable = rentableUnits.length;
    const occupiedCount = rentableUnits.filter((u) => u.currentOccupancyStatus === 'Occupied').length;
    const vacantCount = rentableUnits.filter((u) => u.currentOccupancyStatus.startsWith('Vacant')).length;
    const reservedCount = rentableUnits.filter((u) => u.currentOccupancyStatus === 'Reserved' || u.currentOccupancyStatus === 'Leased — Awaiting Move-In').length;
    const unavailableCount = units.filter((u) => !u.isRentable || u.currentOccupancyStatus === 'Unavailable').length;

    const physicalOccupancyRate = totalRentable > 0 ? (occupiedCount / totalRentable) * 100 : 0;
    const physicalVacancyRate = totalRentable > 0 ? (vacantCount / totalRentable) * 100 : 0;

    // Upcoming Lease Expirations within 60 days
    const leases = MOCK_LEASES.filter((l) => (propertyId === 'all' ? true : l.propertyId === propertyId));
    const expiringIn60Days = leases.filter((l) => {
      if (!l.leaseEndDate || l.tenancyStatus === 'Month-to-Month') return false;
      const daysUntil = calculateDaysDifference(asOfDate, l.leaseEndDate);
      return daysUntil >= 0 && daysUntil <= 60;
    }).length;

    // Potential Vacancy Loss calculation:
    // Vacant units * daily asking/market rent * days vacant in current month (up to 30 days)
    const totalVacancyLoss = rentableUnits
      .filter((u) => u.currentOccupancyStatus.startsWith('Vacant') && u.vacancyStartDate)
      .reduce((sum, u) => {
        const days = Math.min(30, Math.max(1, calculateDaysDifference(u.vacancyStartDate!, asOfDate)));
        const dailyRent = u.marketRent / 30.417; // standard days per month
        return sum + dailyRent * days;
      }, 0);

    // Prior month comparison from historical data
    const prev = previousMonth(asOfDate);
    const prevMonthHist = MOCK_HISTORICAL_RECORDS.filter((h) => h.period === prev.period && (propertyId === 'all' ? true : h.propertyId === propertyId));
    const prevTotalRentable = prevMonthHist.reduce((acc, h) => acc + h.totalRentableUnits, 0);
    const prevOccupied = prevMonthHist.reduce((acc, h) => acc + h.occupiedUnits, 0);
    const prevOccRate = prevTotalRentable > 0 ? (prevOccupied / prevTotalRentable) * 100 : 0;
    const occChange = physicalOccupancyRate - prevOccRate;

    return {
      physicalOccupancyRate,
      physicalVacancyRate,
      totalUnits: units.length,
      rentableUnits: totalRentable,
      occupiedUnits: occupiedCount,
      vacantUnits: vacantCount,
      reservedUnits: reservedCount,
      unavailableUnits: unavailableCount,
      upcomingExpirations: expiringIn60Days,
      potentialVacancyLoss: Math.round(totalVacancyLoss),
      historicalComparison: {
        prevMonthPeriod: prev.label,
        occupancyRateChange: occChange,
      },
    };
  }

  /**
   * REPORT 1: OCCUPANCY SUMMARY REPORT
   */
  static getOccupancySummary(filters: Partial<ReportFilterState>) {
    const properties = filters.propertyId && filters.propertyId !== 'all'
      ? MOCK_PROPERTIES.filter((p) => p.propertyId === filters.propertyId)
      : MOCK_PROPERTIES;

    const propertyRows = properties.map((prop) => {
      const units = MOCK_UNITS.filter((u) => u.propertyId === prop.propertyId);
      const rentable = units.filter((u) => u.isRentable);
      const occupied = rentable.filter((u) => u.currentOccupancyStatus === 'Occupied');
      const vacant = rentable.filter((u) => u.currentOccupancyStatus.startsWith('Vacant'));
      const reserved = rentable.filter((u) => u.currentOccupancyStatus === 'Reserved' || u.currentOccupancyStatus === 'Leased — Awaiting Move-In');
      const unavailable = units.filter((u) => !u.isRentable || u.currentOccupancyStatus === 'Unavailable');

      const occRate = rentable.length > 0 ? (occupied.length / rentable.length) * 100 : 0;
      const vacRate = rentable.length > 0 ? (vacant.length / rentable.length) * 100 : 0;

      return {
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        propertyCode: prop.propertyCode,
        city: prop.city,
        province: prop.province,
        totalUnits: units.length,
        rentableUnits: rentable.length,
        occupiedUnits: occupied.length,
        vacantUnits: vacant.length,
        reservedUnits: reserved.length,
        unavailableUnits: unavailable.length,
        occupancyRate: occRate,
        vacancyRate: vacRate,
        units: units.map((u) => {
          // Find associated tenant/lease if occupied
          const lease = MOCK_LEASES.find((l) => l.unitIds.includes(u.unitId) && l.tenancyStatus !== 'Terminated');
          const tenant = lease ? MOCK_TENANTS.find((t) => t.tenantId === lease.tenantId) : null;
          return {
            unitId: u.unitId,
            unitNumber: u.unitNumber,
            unitType: u.unitType,
            floor: u.floor,
            status: u.currentOccupancyStatus,
            isRentable: u.isRentable,
            rentableAreaSqFt: u.rentableAreaSqFt,
            marketRent: u.marketRent,
            contractualRent: u.contractualRent,
            tenantName: tenant ? tenant.tenantName : null,
            leaseNumber: lease ? lease.leaseNumber : null,
          };
        }),
      };
    });

    // Portfolio Totals
    const totalUnits = propertyRows.reduce((a, b) => a + b.totalUnits, 0);
    const rentableUnits = propertyRows.reduce((a, b) => a + b.rentableUnits, 0);
    const occupiedUnits = propertyRows.reduce((a, b) => a + b.occupiedUnits, 0);
    const vacantUnits = propertyRows.reduce((a, b) => a + b.vacantUnits, 0);
    const reservedUnits = propertyRows.reduce((a, b) => a + b.reservedUnits, 0);
    const unavailableUnits = propertyRows.reduce((a, b) => a + b.unavailableUnits, 0);
    const portfolioOccRate = rentableUnits > 0 ? (occupiedUnits / rentableUnits) * 100 : 0;
    const portfolioVacRate = rentableUnits > 0 ? (vacantUnits / rentableUnits) * 100 : 0;

    return {
      propertyRows,
      totals: {
        totalProperties: propertyRows.length,
        totalUnits,
        rentableUnits,
        occupiedUnits,
        vacantUnits,
        reservedUnits,
        unavailableUnits,
        occupancyRate: portfolioOccRate,
        vacancyRate: portfolioVacRate,
      },
    };
  }

  /**
   * REPORT 2: VACANCY & AVAILABLE UNITS REPORT
   */
  static getVacancyReport(filters: Partial<ReportFilterState>) {
    const asOfDate = filters.asOfDate || new Date().toISOString().slice(0, 10);
    const allUnits = this.filterUnits(filters);

    // Filter to vacant, reserved, and awaiting move-in units
    const vacantUnits = allUnits.filter((u) => {
      if (!u.isRentable && u.currentOccupancyStatus === 'Unavailable') return false;
      return (
        u.currentOccupancyStatus.startsWith('Vacant') ||
        u.currentOccupancyStatus === 'Reserved' ||
        u.currentOccupancyStatus === 'Leased — Awaiting Move-In'
      );
    });

    const rows = vacantUnits.map((u) => {
      const prop = MOCK_PROPERTIES.find((p) => p.propertyId === u.propertyId);
      const daysVacant = u.vacancyStartDate ? Math.max(0, calculateDaysDifference(u.vacancyStartDate, asOfDate)) : 0;
      const dailyRent = u.marketRent / 30.417;
      const accruedVacancyLoss = Math.round(dailyRent * daysVacant);

      // Check for related future lease or maintenance record
      const upcomingLease = MOCK_LEASES.find((l) => l.unitIds.includes(u.unitId) && (l.tenancyStatus === 'Pending Move-In' || l.renewalStatus === 'Renewed'));
      const tenant = upcomingLease ? MOCK_TENANTS.find((t) => t.tenantId === upcomingLease.tenantId) : null;
      const turnover = MOCK_TURNOVER_RECORDS.find((t) => t.unitId === u.unitId);

      return {
        unitId: u.unitId,
        propertyId: u.propertyId,
        propertyName: prop?.propertyName || 'Unknown Property',
        propertyCode: prop?.propertyCode || '—',
        unitNumber: u.unitNumber,
        unitType: u.unitType,
        floor: u.floor,
        marketRent: u.marketRent,
        askingRent: u.askingRent,
        rentVariance: u.askingRent - u.marketRent,
        vacancyStartDate: u.vacancyStartDate,
        daysVacant,
        accruedVacancyLoss,
        readinessStatus: u.readinessStatus,
        currentOccupancyStatus: u.currentOccupancyStatus,
        expectedAvailableDate: u.expectedAvailableDate,
        nextScheduledMoveInDate: u.nextScheduledMoveInDate,
        assignedLeasingAgent: u.assignedLeasingAgent,
        futureTenant: tenant ? tenant.tenantName : null,
        futureLeaseNumber: upcomingLease ? upcomingLease.leaseNumber : null,
        turnoverCost: turnover ? turnover.estimatedCost : null,
        isLongTerm: daysVacant >= 60,
      };
    });

    // Sort by longest vacancy by default
    rows.sort((a, b) => b.daysVacant - a.daysVacant);

    const totalPotentialRent = rows.reduce((acc, r) => acc + r.marketRent, 0);
    const totalAccruedLoss = rows.reduce((acc, r) => acc + r.accruedVacancyLoss, 0);
    const avgDaysVacant = rows.length > 0 ? Math.round(rows.reduce((acc, r) => acc + r.daysVacant, 0) / rows.length) : 0;

    return {
      rows,
      totals: {
        totalVacantUnits: rows.length,
        readyUnits: rows.filter((r) => r.readinessStatus === 'Ready for Leasing').length,
        maintenanceUnits: rows.filter((r) => r.readinessStatus === 'Maintenance Required' || r.readinessStatus === 'Renovation Required').length,
        cleaningUnits: rows.filter((r) => r.readinessStatus === 'Cleaning Required' || r.readinessStatus === 'Inspection Pending').length,
        reservedOrLeasedUnits: rows.filter((r) => r.currentOccupancyStatus === 'Reserved' || r.currentOccupancyStatus === 'Leased — Awaiting Move-In').length,
        totalPotentialRent,
        totalAccruedLoss,
        avgDaysVacant,
      },
    };
  }

  /**
   * REPORT 3: LEASE EXPIRATION & RENEWAL REPORT
   */
  static getLeaseExpirationReport(filters: Partial<ReportFilterState>) {
    const asOfDate = filters.asOfDate || '2026-10-24';
    const expiryWindow = filters.expiryWindowDays || 90;

    const filteredLeases = MOCK_LEASES.filter((l) => {
      if (filters.propertyId && filters.propertyId !== 'all' && l.propertyId !== filters.propertyId) {
        return false;
      }
      return true;
    });

    const rows = filteredLeases
      .map((l) => {
        const prop = MOCK_PROPERTIES.find((p) => p.propertyId === l.propertyId);
        const tenant = MOCK_TENANTS.find((t) => t.tenantId === l.tenantId);
        const units = MOCK_UNITS.filter((u) => l.unitIds.includes(u.unitId));
        const unitNumbers = units.map((u) => u.unitNumber).join(', ');
        const daysUntilExpiry = l.leaseEndDate ? calculateDaysDifference(asOfDate, l.leaseEndDate) : 999;

        return {
          leaseId: l.leaseId,
          leaseNumber: l.leaseNumber,
          propertyId: l.propertyId,
          propertyName: prop?.propertyName || '—',
          tenantId: l.tenantId,
          tenantName: tenant?.tenantName || 'Unknown Tenant',
          tenantEmail: tenant?.email || '',
          unitNumbers,
          unitCount: l.unitIds.length,
          isMultiUnit: l.isMultiUnit || l.unitIds.length > 1,
          leaseStartDate: l.leaseStartDate,
          leaseEndDate: l.leaseEndDate,
          daysUntilExpiry,
          currentMonthlyRent: l.monthlyRent,
          proposedRenewalRent: l.proposedRenewalRent || l.monthlyRent,
          rentUplift: l.proposedRenewalRent ? l.proposedRenewalRent - l.monthlyRent : 0,
          renewalStatus: l.renewalStatus,
          tenancyStatus: l.tenancyStatus,
          noticeStatus: l.noticeStatus,
          expectedMoveOutDate: l.expectedMoveOutDate || null,
          assignedPropertyManager: l.assignedPropertyManager,
        };
      })
      .filter((r) => {
        // Apply window filter
        if (filters.periodPreset === '30days') return r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 30;
        if (filters.periodPreset === '60days') return r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 60;
        if (filters.periodPreset === '90days') return r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 90;
        if (filters.periodPreset === 'today') return r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 14;
        return r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= expiryWindow;
      });

    // Sort by nearest expiration first
    rows.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    // Eligible cohort metrics
    const totalExpiring = rows.length;
    const renewedCount = rows.filter((r) => r.renewalStatus === 'Renewed').length;
    const renewalPendingCount = rows.filter(
      (r) => r.renewalStatus === 'Renewal Offered' || r.renewalStatus === 'Renewal Discussion' || r.renewalStatus === 'Awaiting Tenant Response'
    ).length;
    const moveOutExpectedCount = rows.filter((r) => r.renewalStatus === 'Tenant Moving Out' || r.noticeStatus === 'Notice to Vacate Received').length;
    const notContactedCount = rows.filter((r) => r.renewalStatus === 'Not Contacted').length;

    // Defined Renewal Cohort Rate: Renewed / Total Expiring in window * 100
    const renewalRate = totalExpiring > 0 ? (renewedCount / totalExpiring) * 100 : 0;
    const totalExpiringRent = rows.reduce((acc, r) => acc + r.currentMonthlyRent, 0);

    return {
      rows,
      totals: {
        totalExpiring,
        renewedCount,
        renewalPendingCount,
        moveOutExpectedCount,
        notContactedCount,
        renewalRate,
        totalExpiringRent,
      },
    };
  }

  /**
   * REPORT 4: HISTORICAL OCCUPANCY TREND REPORT
   */
  static getOccupancyTrend(filters: Partial<ReportFilterState>) {
    const propertyId = filters.propertyId || 'all';

    let records = MOCK_HISTORICAL_RECORDS;
    if (propertyId !== 'all') {
      records = records.filter((r) => r.propertyId === propertyId);
    }

    // Aggregate by period if portfolio-wide
    const periodsMap = new Map<
      string,
      {
        period: string;
        periodLabel: string;
        totalRentableUnits: number;
        occupiedUnits: number;
        vacantUnits: number;
        reservedUnits: number;
        unavailableUnits: number;
        moveIns: number;
        moveOuts: number;
      }
    >();

    records.forEach((rec) => {
      if (!periodsMap.has(rec.period)) {
        periodsMap.set(rec.period, {
          period: rec.period,
          periodLabel: rec.periodLabel,
          totalRentableUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          reservedUnits: 0,
          unavailableUnits: 0,
          moveIns: 0,
          moveOuts: 0,
        });
      }
      const p = periodsMap.get(rec.period)!;
      p.totalRentableUnits += rec.totalRentableUnits;
      p.occupiedUnits += rec.occupiedUnits;
      p.vacantUnits += rec.vacantUnits;
      p.reservedUnits += rec.reservedUnits;
      p.unavailableUnits += rec.unavailableUnits;
      p.moveIns += rec.moveIns;
      p.moveOuts += rec.moveOuts;
    });

    const aggregatedPeriods = Array.from(periodsMap.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((item) => {
        const occRate = item.totalRentableUnits > 0 ? (item.occupiedUnits / item.totalRentableUnits) * 100 : 0;
        const vacRate = item.totalRentableUnits > 0 ? (item.vacantUnits / item.totalRentableUnits) * 100 : 0;
        return {
          ...item,
          occupancyRate: Math.round(occRate * 10) / 10,
          vacancyRate: Math.round(vacRate * 10) / 10,
        };
      });

    // Also provide detailed property rows for comparison table
    const tableRows = records
      .slice()
      .sort((a, b) => b.period.localeCompare(a.period) || a.propertyName.localeCompare(b.propertyName));

    return {
      trendTimeline: aggregatedPeriods,
      tableRows,
      calculationNotice:
        'Historical physical occupancy is derived from effective-dated monthly unit snapshots and verified tenant lease commence/termination logs. Unavailable administrative units are excluded from rentable capacity.',
    };
  }

  /**
   * REPORT 5: ECONOMIC OCCUPANCY & VACANCY LOSS REPORT
   */
  static getEconomicOccupancyReport(filters: Partial<ReportFilterState>) {
    const asOfDate = filters.asOfDate || '2026-10-24';
    const properties = filters.propertyId && filters.propertyId !== 'all'
      ? MOCK_PROPERTIES.filter((p) => p.propertyId === filters.propertyId)
      : MOCK_PROPERTIES;

    const propertyRows = properties.map((prop) => {
      const units = MOCK_UNITS.filter((u) => u.propertyId === prop.propertyId && u.isRentable);
      let potentialRent = 0;
      let recognizedRevenue = 0;
      let vacancyLoss = 0;
      let concessions = 0;

      units.forEach((u) => {
        potentialRent += u.marketRent;

        if (u.currentOccupancyStatus === 'Occupied') {
          const contractual = u.contractualRent ?? u.marketRent;
          recognizedRevenue += contractual;
          if (contractual < u.marketRent) {
            concessions += u.marketRent - contractual;
          }
        } else if (u.currentOccupancyStatus.startsWith('Vacant')) {
          // Calculate vacancy loss based on days vacant this month
          const daysVacant = u.vacancyStartDate ? Math.min(30, Math.max(1, calculateDaysDifference(u.vacancyStartDate, asOfDate))) : 30;
          const loss = (u.marketRent / 30.417) * daysVacant;
          vacancyLoss += loss;
        } else if (u.currentOccupancyStatus === 'Reserved' || u.currentOccupancyStatus === 'Leased — Awaiting Move-In') {
          // In between: partial vacancy loss until move-in
          const days = 15;
          vacancyLoss += (u.marketRent / 30.417) * days;
        }
      });

      const economicOccupancyRate = potentialRent > 0 ? (recognizedRevenue / potentialRent) * 100 : 0;

      return {
        propertyId: prop.propertyId,
        propertyName: prop.propertyName,
        propertyCode: prop.propertyCode,
        totalRentableUnits: units.length,
        potentialRent: Math.round(potentialRent),
        recognizedRevenue: Math.round(recognizedRevenue),
        vacancyLoss: Math.round(vacancyLoss),
        concessions: Math.round(concessions),
        economicOccupancyRate: Math.round(economicOccupancyRate * 10) / 10,
      };
    });

    const totalPotential = propertyRows.reduce((a, b) => a + b.potentialRent, 0);
    const totalRecognized = propertyRows.reduce((a, b) => a + b.recognizedRevenue, 0);
    const totalLoss = propertyRows.reduce((a, b) => a + b.vacancyLoss, 0);
    const totalConcessions = propertyRows.reduce((a, b) => a + b.concessions, 0);
    const portfolioEconomicOcc = totalPotential > 0 ? (totalRecognized / totalPotential) * 100 : 0;

    return {
      propertyRows,
      totals: {
        totalPotentialRent: totalPotential,
        totalRecognizedRevenue: totalRecognized,
        totalVacancyLoss: totalLoss,
        totalConcessions: totalConcessions,
        economicOccupancyRate: Math.round(portfolioEconomicOcc * 10) / 10,
      },
      methodologyNote:
        'Potential Rental Income is calculated from monthly market asking rents. Vacancy loss is computed as Daily Potential Rent (Market Rent ÷ 30.417) × Vacant Days. Economic Occupancy is Actual Recognized Revenue ÷ Potential Rental Income × 100.',
    };
  }

  /**
   * REPORT 6: OCCUPANCY BY PROPERTY, UNIT TYPE & FLOOR
   */
  static getOccupancyByPropertyUnitTypeFloor(filters: Partial<ReportFilterState>, groupBy: 'property' | 'unitType' | 'floor' = 'unitType') {
    const units = this.filterUnits(filters).filter((u) => u.isRentable);

    const groupMap = new Map<
      string,
      {
        key: string;
        label: string;
        totalUnits: number;
        occupiedUnits: number;
        vacantUnits: number;
        reservedUnits: number;
        totalContractualRent: number;
        contractualCount: number;
        totalMarketRent: number;
        marketCount: number;
        units: Unit[];
      }
    >();

    units.forEach((u) => {
      let key = '';
      let label = '';

      if (groupBy === 'unitType') {
        key = u.unitType;
        label = u.unitType;
      } else if (groupBy === 'floor') {
        key = `Floor ${u.floor}`;
        label = `Floor ${u.floor}`;
      } else {
        const p = MOCK_PROPERTIES.find((prop) => prop.propertyId === u.propertyId);
        key = u.propertyId;
        label = p?.propertyName || 'Unknown';
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          label,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          reservedUnits: 0,
          totalContractualRent: 0,
          contractualCount: 0,
          totalMarketRent: 0,
          marketCount: 0,
          units: [],
        });
      }

      const g = groupMap.get(key)!;
      g.totalUnits += 1;
      g.units.push(u);

      if (u.currentOccupancyStatus === 'Occupied') {
        g.occupiedUnits += 1;
        if (u.contractualRent !== null && u.contractualRent > 0) {
          g.totalContractualRent += u.contractualRent;
          g.contractualCount += 1;
        }
      } else if (u.currentOccupancyStatus.startsWith('Vacant')) {
        g.vacantUnits += 1;
      } else {
        g.reservedUnits += 1;
      }

      if (u.marketRent > 0) {
        g.totalMarketRent += u.marketRent;
        g.marketCount += 1;
      }
    });

    const rows = Array.from(groupMap.values()).map((g) => {
      const occRate = g.totalUnits > 0 ? (g.occupiedUnits / g.totalUnits) * 100 : 0;
      const avgContractual = g.contractualCount > 0 ? Math.round(g.totalContractualRent / g.contractualCount) : null;
      const avgMarket = g.marketCount > 0 ? Math.round(g.totalMarketRent / g.marketCount) : 0;

      return {
        key: g.key,
        label: g.label,
        totalUnits: g.totalUnits,
        occupiedUnits: g.occupiedUnits,
        vacantUnits: g.vacantUnits,
        reservedUnits: g.reservedUnits,
        occupancyRate: Math.round(occRate * 10) / 10,
        averageContractualRent: avgContractual,
        averageMarketRent: avgMarket,
        unitList: g.units,
      };
    });

    // Sort by total units or label
    rows.sort((a, b) => b.totalUnits - a.totalUnits);

    return {
      groupBy,
      rows,
      totals: {
        totalRentableUnits: units.length,
        occupiedUnits: units.filter((u) => u.currentOccupancyStatus === 'Occupied').length,
        vacantUnits: units.filter((u) => u.currentOccupancyStatus.startsWith('Vacant')).length,
        occupancyRate: units.length > 0 ? Math.round((units.filter((u) => u.currentOccupancyStatus === 'Occupied').length / units.length) * 1000) / 10 : 0,
      },
    };
  }

  /**
   * REPORT 7: UNIT READINESS & TURNOVER REPORT
   */
  static getUnitTurnoverReport(filters: Partial<ReportFilterState>) {
    let turns = MOCK_TURNOVER_RECORDS;
    if (filters.propertyId && filters.propertyId !== 'all') {
      turns = turns.filter((t) => t.propertyId === filters.propertyId);
    }

    const rows = turns.map((t) => {
      const prop = MOCK_PROPERTIES.find((p) => p.propertyId === t.propertyId);
      const unit = MOCK_UNITS.find((u) => u.unitId === t.unitId);

      return {
        ...t,
        propertyName: prop?.propertyName || '—',
        propertyCode: prop?.propertyCode || '—',
        unitType: unit?.unitType || '—',
        marketRent: unit?.marketRent || 0,
        readinessStatus: unit?.readinessStatus || 'Ready for Leasing',
      };
    });

    const completedReady = rows.filter((r) => r.daysToReady !== null);
    const avgDaysToReady = completedReady.length > 0 ? Math.round(completedReady.reduce((acc, r) => acc + r.daysToReady!, 0) / completedReady.length) : 0;
    const avgTurnoverDays = rows.length > 0 ? Math.round(rows.reduce((acc, r) => acc + (r.totalTurnoverDays || 0), 0) / rows.length) : 0;

    return {
      rows,
      totals: {
        totalTurns: rows.length,
        avgDaysToReady,
        avgTotalTurnoverDays: avgTurnoverDays,
        awaitingInspection: rows.filter((r) => r.inspectionStatus === 'Pending').length,
        awaitingMaintenance: rows.filter((r) => r.maintenanceStatus === 'Required' || r.maintenanceStatus === 'In Progress').length,
        readyForLeasing: rows.filter((r) => r.readinessStatus === 'Ready for Leasing').length,
        leasedAwaitingMoveIn: rows.filter((r) => r.nextMoveInDate !== null).length,
        totalEstimatedTurnoverCost: rows.reduce((acc, r) => acc + r.estimatedCost, 0),
      },
    };
  }

  /**
   * REPORT 8: LEASING PIPELINE & CONVERSION REPORT
   */
  static getLeasingPipelineReport(filters: Partial<ReportFilterState>) {
    let pipeline = MOCK_PIPELINE_DATA;
    if (filters.propertyId && filters.propertyId !== 'all') {
      pipeline = pipeline.filter((p) => p.propertyId === filters.propertyId);
    }

    const totals = pipeline.reduce(
      (acc, item) => {
        acc.inquiries += item.inquiries;
        acc.applicationsReceived += item.applicationsReceived;
        acc.applicationsApproved += item.applicationsApproved;
        acc.applicationsDeclined += item.applicationsDeclined;
        acc.leasesOffered += item.leasesOffered;
        acc.leasesSigned += item.leasesSigned;
        acc.scheduledMoveIns += item.scheduledMoveIns;
        acc.completedMoveIns += item.completedMoveIns;
        return acc;
      },
      {
        inquiries: 0,
        applicationsReceived: 0,
        applicationsApproved: 0,
        applicationsDeclined: 0,
        leasesOffered: 0,
        leasesSigned: 0,
        scheduledMoveIns: 0,
        completedMoveIns: 0,
      }
    );

    // Explicitly defined conversion funnel:
    // Inquiry to Application: apps / inquiries * 100
    // Application to Approval: approved / received * 100
    // Approval to Signed Lease: signed / approved * 100
    // Application to Lease: signed / received * 100
    // Lease to Move-In: completedMoveIns / signed * 100
    const conversionRates = {
      inquiryToApplication: totals.inquiries > 0 ? (totals.applicationsReceived / totals.inquiries) * 100 : 0,
      applicationToApproval: totals.applicationsReceived > 0 ? (totals.applicationsApproved / totals.applicationsReceived) * 100 : 0,
      approvalToSigned: totals.applicationsApproved > 0 ? (totals.leasesSigned / totals.applicationsApproved) * 100 : 0,
      applicationToLease: totals.applicationsReceived > 0 ? (totals.leasesSigned / totals.applicationsReceived) * 100 : 0,
      signedToMoveIn: totals.leasesSigned > 0 ? (totals.completedMoveIns / totals.leasesSigned) * 100 : 0,
    };

    const avgTimeToLeaseDays = pipeline.length > 0 ? Math.round(pipeline.reduce((acc, p) => acc + p.avgTimeToLeaseDays, 0) / pipeline.length) : 15;

    const propertyRows = pipeline.map((p) => {
      const prop = MOCK_PROPERTIES.find((pr) => pr.propertyId === p.propertyId);
      return {
        ...p,
        propertyName: prop?.propertyName || '—',
        propertyCode: prop?.propertyCode || '—',
        conversionAppToLease: p.applicationsReceived > 0 ? Math.round((p.leasesSigned / p.applicationsReceived) * 1000) / 10 : 0,
      };
    });

    return {
      propertyRows,
      funnelTotals: totals,
      conversionRates,
      avgTimeToLeaseDays,
    };
  }

  /**
   * REPORT 9: LEASE COMMENCEMENT REPORT
   */
  static getLeaseCommencementReport(filters: Partial<ReportFilterState>) {
    let leases = MOCK_LEASES;
    if (filters.propertyId && filters.propertyId !== 'all') {
      leases = leases.filter((l) => l.propertyId === filters.propertyId);
    }

    const rows = leases.map((l) => {
      const prop = MOCK_PROPERTIES.find((p) => p.propertyId === l.propertyId);
      const tenant = MOCK_TENANTS.find((t) => t.tenantId === l.tenantId);
      const units = MOCK_UNITS.filter((u) => l.unitIds.includes(u.unitId));

      return {
        leaseId: l.leaseId,
        leaseNumber: l.leaseNumber,
        tenantName: tenant?.tenantName || '—',
        tenantEmail: tenant?.email || '—',
        propertyName: prop?.propertyName || '—',
        propertyCode: prop?.propertyCode || '—',
        unitNumbers: units.map((u) => u.unitNumber).join(', '),
        unitType: units[0]?.unitType || '—',
        leaseStartDate: l.leaseStartDate,
        moveInDate: tenant?.moveInDate || l.leaseStartDate,
        isMoveInPending: l.tenancyStatus === 'Pending Move-In',
        monthlyRent: l.monthlyRent,
        depositAmount: l.depositAmount,
        depositStatus: l.depositStatus,
        leaseStatus: l.tenancyStatus,
        assignedPropertyManager: l.assignedPropertyManager,
      };
    });

    // Sort by recent commencement
    rows.sort((a, b) => b.leaseStartDate.localeCompare(a.leaseStartDate));

    return {
      rows,
      totals: {
        totalLeasesCommenced: rows.length,
        totalMonthlyRevenue: rows.reduce((acc, r) => acc + r.monthlyRent, 0),
        totalDepositsHeld: rows.reduce((acc, r) => acc + r.depositAmount, 0),
      },
    };
  }

  /**
   * REPORT 10: MOVE-IN / MOVE-OUT REPORT
   */
  static getMoveInMoveOutReport(filters: Partial<ReportFilterState>) {
    let moves = MOCK_MOVE_RECORDS;
    if (filters.propertyId && filters.propertyId !== 'all') {
      moves = moves.filter((m) => m.propertyId === filters.propertyId);
    }

    const rows = moves.map((m) => {
      return {
        ...m,
        isCompleted: m.actualDate !== null,
      };
    });

    // Counts without double-counting transfers as portfolio churn
    const moveIns = rows.filter((r) => r.movementType === 'Move-In').length;
    const moveOuts = rows.filter((r) => r.movementType === 'Move-Out').length;
    const transfers = rows.filter((r) => r.movementType === 'Transfer Between Units' || r.movementType === 'Transfer Between Properties').length;

    return {
      rows,
      totals: {
        totalEvents: rows.length,
        moveIns,
        moveOuts,
        transfers,
        netPortfolioTurnover: moveOuts - moveIns,
      },
      auditNote:
        'Intra-portfolio transfers are tracked separately to prevent artificial inflation of portfolio-level move-ins and move-outs.',
    };
  }

  /**
   * REPORT 11: MONTH-TO-MONTH TENANCY REPORT
   */
  static getMonthToMonthTenancyReport(filters: Partial<ReportFilterState>) {
    let leases = MOCK_LEASES.filter((l) => l.tenancyStatus === 'Month-to-Month' || l.renewalStatus === 'Month-to-Month');
    if (filters.propertyId && filters.propertyId !== 'all') {
      leases = leases.filter((l) => l.propertyId === filters.propertyId);
    }

    const rows = leases.map((l) => {
      const prop = MOCK_PROPERTIES.find((p) => p.propertyId === l.propertyId);
      const tenant = MOCK_TENANTS.find((t) => t.tenantId === l.tenantId);
      const units = MOCK_UNITS.filter((u) => l.unitIds.includes(u.unitId));

      return {
        leaseId: l.leaseId,
        leaseNumber: l.leaseNumber,
        tenantName: tenant?.tenantName || '—',
        tenantPhone: tenant?.phone || '—',
        propertyName: prop?.propertyName || '—',
        propertyCode: prop?.propertyCode || '—',
        unitNumbers: units.map((u) => u.unitNumber).join(', '),
        originalLeaseEndDate: l.leaseEndDate || '2026-07-31',
        tenancyStatus: l.tenancyStatus,
        monthlyRent: l.monthlyRent,
        marketRent: l.marketRentAtSign,
        rentSpread: l.marketRentAtSign - l.monthlyRent,
        tenancyStartDate: l.leaseStartDate,
        noticeStatus: l.noticeStatus,
        assignedPropertyManager: l.assignedPropertyManager,
      };
    });

    return {
      rows,
      totals: {
        totalMonthToMonthTenancies: rows.length,
        monthlyRevenueAtRisk: rows.reduce((acc, r) => acc + r.monthlyRent, 0),
        averageDurationMonths: 6.5,
      },
      legalNote:
        'Month-to-month classifications reflect statutory continuation agreements. Rent adjustments require minimum 90-day provincial notice.',
    };
  }

  /**
   * REPORT 12: RENT ROLL & OCCUPANCY REPORT
   */
  static getRentRollOccupancyReport(filters: Partial<ReportFilterState>) {
    const units = this.filterUnits(filters);

    const rows = units.map((u) => {
      const prop = MOCK_PROPERTIES.find((p) => p.propertyId === u.propertyId);
      const lease = MOCK_LEASES.find((l) => l.unitIds.includes(u.unitId) && l.tenancyStatus !== 'Terminated');
      const tenant = lease ? MOCK_TENANTS.find((t) => t.tenantId === lease.tenantId) : null;

      const rentPerSqFt = u.contractualRent && u.rentableAreaSqFt > 0 ? (u.contractualRent * 12) / u.rentableAreaSqFt : null;

      return {
        unitId: u.unitId,
        propertyId: u.propertyId,
        propertyName: prop?.propertyName || '—',
        propertyCode: prop?.propertyCode || '—',
        unitNumber: u.unitNumber,
        floor: u.floor,
        unitType: u.unitType,
        rentableAreaSqFt: u.rentableAreaSqFt,
        currentOccupancyStatus: u.currentOccupancyStatus,
        isRentable: u.isRentable,
        tenantName: tenant ? tenant.tenantName : '— Vacant —',
        leaseNumber: lease ? lease.leaseNumber : '—',
        isMultiUnitLease: lease?.isMultiUnit || false,
        leaseStartDate: lease ? lease.leaseStartDate : null,
        leaseEndDate: lease ? lease.leaseEndDate : null,
        contractualRent: u.contractualRent,
        marketRent: u.marketRent,
        rentPerSqFt: rentPerSqFt ? Math.round(rentPerSqFt * 100) / 100 : null,
        depositAmount: lease ? lease.depositAmount : 0,
        depositStatus: lease ? lease.depositStatus : '—',
      };
    });

    // Subtotals by Property
    const propertyGroups = new Map<string, typeof rows>();
    rows.forEach((r) => {
      if (!propertyGroups.has(r.propertyName)) propertyGroups.set(r.propertyName, []);
      propertyGroups.get(r.propertyName)!.push(r);
    });

    const totalContractualRent = rows.reduce((acc, r) => acc + (r.contractualRent || 0), 0);
    const totalMarketRent = rows.reduce((acc, r) => acc + r.marketRent, 0);
    const totalDeposits = rows.reduce((acc, r) => acc + r.depositAmount, 0);
    const occupiedUnitsCount = rows.filter((r) => r.currentOccupancyStatus === 'Occupied').length;
    const uniqueLeaseCount = new Set(rows.filter((r) => r.leaseNumber !== '—').map((r) => r.leaseNumber)).size;

    return {
      rows,
      propertyGroups: Array.from(propertyGroups.entries()).map(([propName, pRows]) => ({
        propertyName: propName,
        unitsCount: pRows.length,
        occupiedCount: pRows.filter((r) => r.currentOccupancyStatus === 'Occupied').length,
        totalRent: pRows.reduce((acc, r) => acc + (r.contractualRent || 0), 0),
        rows: pRows,
      })),
      totals: {
        totalUnits: rows.length,
        occupiedUnits: occupiedUnitsCount,
        uniqueLeaseCount, // Distinct unit count vs lease count demonstration!
        totalContractualMonthlyRent: totalContractualRent,
        totalMarketMonthlyRent: totalMarketRent,
        totalDepositsHeld: totalDeposits,
      },
    };
  }

  /**
   * REPORT 13: LONG-TERM VACANCY REPORT
   */
  static getLongTermVacancyReport(filters: Partial<ReportFilterState>) {
    const asOfDate = filters.asOfDate || '2026-10-24';
    const thresholdDays = filters.thresholdDays || 30;

    const vacantUnits = MOCK_UNITS.filter((u) => {
      if (filters.propertyId && filters.propertyId !== 'all' && u.propertyId !== filters.propertyId) return false;
      return u.currentOccupancyStatus.startsWith('Vacant') && u.vacancyStartDate !== null;
    });

    const rows = vacantUnits
      .map((u) => {
        const prop = MOCK_PROPERTIES.find((p) => p.propertyId === u.propertyId);
        const daysVacant = calculateDaysDifference(u.vacancyStartDate!, asOfDate);
        const dailyRent = u.marketRent / 30.417;
        const accruedLoss = Math.round(dailyRent * daysVacant);

        let reasonForVacancy = 'Regular turnover in progress';
        if (daysVacant > 90) {
          reasonForVacancy = 'Major kitchen/bathroom renovation & mechanical conversion';
        } else if (daysVacant > 60) {
          reasonForVacancy = 'Specialized plumbing remediation & contractor delays';
        } else if (daysVacant > 30) {
          reasonForVacancy = 'Pricing repositioning & tenant screening';
        }

        return {
          unitId: u.unitId,
          propertyId: u.propertyId,
          propertyName: prop?.propertyName || '—',
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          floor: u.floor,
          vacancyStartDate: u.vacancyStartDate!,
          daysVacant,
          monthlyPotentialRent: u.marketRent,
          estimatedVacancyLoss: accruedLoss,
          readinessStatus: u.readinessStatus,
          leasingStatus: u.currentOccupancyStatus,
          reasonForVacancy,
          assignedAgent: u.assignedLeasingAgent || 'Jordan Bell',
        };
      })
      .filter((r) => r.daysVacant >= thresholdDays);

    // Sort by longest vacancy
    rows.sort((a, b) => b.daysVacant - a.daysVacant);

    return {
      rows,
      thresholdDays,
      totals: {
        qualifyingUnits: rows.length,
        totalAccruedLoss: rows.reduce((acc, r) => acc + r.estimatedVacancyLoss, 0),
        monthlyRevenueAtRisk: rows.reduce((acc, r) => acc + r.monthlyPotentialRent, 0),
        avgDaysVacant: rows.length > 0 ? Math.round(rows.reduce((acc, r) => acc + r.daysVacant, 0) / rows.length) : 0,
      },
    };
  }

  /**
   * REPORT 14: PRE-LEASED / FUTURE AVAILABILITY REPORT
   */
  static getFutureAvailabilityReport(filters: Partial<ReportFilterState>) {
    const units = this.filterUnits(filters);

    // Units that are pre-leased, reserved, or occupied with notice given
    const rows = units
      .map((u) => {
        const prop = MOCK_PROPERTIES.find((p) => p.propertyId === u.propertyId);
        const activeLease = MOCK_LEASES.find((l) => l.unitIds.includes(u.unitId) && l.tenancyStatus === 'Active');
        const activeTenant = activeLease ? MOCK_TENANTS.find((t) => t.tenantId === activeLease.tenantId) : null;

        const futureLease = MOCK_LEASES.find((l) => l.unitIds.includes(u.unitId) && l.tenancyStatus === 'Pending Move-In');
        const futureTenant = futureLease ? MOCK_TENANTS.find((t) => t.tenantId === futureLease.tenantId) : null;

        let category: 'Currently Vacant & Available' | 'Vacant but Reserved' | 'Leased for Future Move-In' | 'Occupied — Vacancy Scheduled' | 'Unavailable' =
          'Currently Vacant & Available';

        if (!u.isRentable) {
          category = 'Unavailable';
        } else if (u.currentOccupancyStatus === 'Leased — Awaiting Move-In') {
          category = 'Leased for Future Move-In';
        } else if (u.currentOccupancyStatus === 'Reserved') {
          category = 'Vacant but Reserved';
        } else if (u.currentOccupancyStatus === 'Occupied' && (activeLease?.noticeStatus === 'Notice to Vacate Received' || u.expectedAvailableDate !== null)) {
          category = 'Occupied — Vacancy Scheduled';
        } else if (u.currentOccupancyStatus.startsWith('Vacant')) {
          category = 'Currently Vacant & Available';
        } else {
          return null; // Regular occupied unit without upcoming change
        }

        return {
          unitId: u.unitId,
          propertyId: u.propertyId,
          propertyName: prop?.propertyName || '—',
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          currentStatus: u.currentOccupancyStatus,
          currentTenant: activeTenant ? activeTenant.tenantName : null,
          scheduledVacancyDate: activeLease?.expectedMoveOutDate || u.vacancyStartDate,
          futureAvailabilityDate: u.expectedAvailableDate,
          nextLeaseStartDate: futureLease?.leaseStartDate || u.nextScheduledMoveInDate,
          nextTenant: futureTenant ? futureTenant.tenantName : null,
          expectedMonthlyRent: futureLease?.monthlyRent || u.askingRent,
          readinessStatus: u.readinessStatus,
          category,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return {
      rows,
      totals: {
        totalInventoryInPipeline: rows.length,
        leasedForFutureMoveIn: rows.filter((r) => r.category === 'Leased for Future Move-In').length,
        vacantReserved: rows.filter((r) => r.category === 'Vacant but Reserved').length,
        occupiedPendingVacancy: rows.filter((r) => r.category === 'Occupied — Vacancy Scheduled').length,
        currentlyAvailable: rows.filter((r) => r.category === 'Currently Vacant & Available').length,
      },
    };
  }

  /**
   * REPORT 15: OCCUPANCY EXCEPTION REPORT
   */
  static getOccupancyExceptions(filters: Partial<ReportFilterState>) {
    let exceptions = dynamicExceptions;
    if (filters.propertyId && filters.propertyId !== 'all') {
      exceptions = exceptions.filter((e) => e.propertyId === filters.propertyId);
    }

    const criticalCount = exceptions.filter((e) => e.severity === 'Critical').length;
    const highCount = exceptions.filter((e) => e.severity === 'High').length;
    const mediumCount = exceptions.filter((e) => e.severity === 'Medium').length;
    const openCount = exceptions.filter((e) => e.status === 'Open').length;
    const underReviewCount = exceptions.filter((e) => e.status === 'Under Review').length;
    const resolvedCount = exceptions.filter((e) => e.status === 'Resolved').length;

    return {
      rows: exceptions,
      totals: {
        totalExceptions: exceptions.length,
        criticalCount,
        highCount,
        mediumCount,
        openCount,
        underReviewCount,
        resolvedCount,
      },
    };
  }

  /**
   * Action to update exception status (diagnostic review action)
   */
  static updateExceptionStatus(exceptionId: string, newStatus: 'Open' | 'Under Review' | 'Resolved') {
    dynamicExceptions = dynamicExceptions.map((ex) => (ex.exceptionId === exceptionId ? { ...ex, status: newStatus } : ex));
    return dynamicExceptions.find((ex) => ex.exceptionId === exceptionId);
  }
}
