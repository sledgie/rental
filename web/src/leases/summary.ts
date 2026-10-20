// Lease figures shared by the Leases page and the Dashboard.
import { dateOffset, formatMoney, leaseMonthlyRent, type Lease, type LeaseData } from "./leaseData";

export function daysFromToday(date?: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  const target = new Date(`${date}T12:00:00`).getTime();
  const today = new Date(`${dateOffset(0)}T12:00:00`).getTime();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function isLeaseExpiringSoon(lease: Lease) {
  const deadlineDays = daysFromToday(lease.renewalDeadline);
  const endDays = daysFromToday(lease.endDate);
  return lease.status === "Expiring" || (lease.status === "Active" && ((deadlineDays >= 0 && deadlineDays <= 60) || (endDays >= 0 && endDays <= 60)));
}

export function leaseSummary(data: LeaseData) {
  const live = data.leases.filter((lease) => lease.status === "Active" || lease.status === "Expiring");
  return {
    total: data.leases.length,
    active: data.leases.filter((lease) => lease.status === "Active").length,
    expiring: data.leases.filter(isLeaseExpiringSoon).length,
    pendingSignature: data.leases.filter((lease) => lease.status === "Pending Signature").length,
    monthlyRent: live.reduce((total, lease) => total + leaseMonthlyRent(lease, data.leaseUnits), 0),
    format: formatMoney,
  };
}
